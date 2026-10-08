/** DMG background, window, and object compositor. PPU mode timing is intentionally approximate. */
export class Ppu {
  public readonly frame = new Uint8ClampedArray(160 * 144 * 4);
  private shade: readonly (readonly [number,number,number])[] = [[224,248,208],[136,192,112],[52,104,86],[8,24,32]];
  private readonly bgIds = new Uint8Array(160 * 144);
  private dots = 0;
  private line = 0;
  private statSignal = false;
  public setPalette(name:'classic'|'blue'|'amber'|'mono'):void { this.shade=name==='blue'?[[222,239,239],[142,197,207],[63,117,142],[24,49,76]]:name==='amber'?[[255,242,204],[232,192,115],[165,104,54],[70,43,37]]:name==='mono'?[[245,245,238],[175,179,168],[91,99,92],[27,35,33]]:[[224,248,208],[136,192,112],[52,104,86],[8,24,32]]; }
  public reset(): void { this.bgIds.fill(0); this.dots=0;this.line=0;this.statSignal=false;for (let p = 0; p < 160 * 144; p += 1) this.setPixel(p, 0); }
  public tick(cycles:number,bus:{read8(a:number):number;write8(a:number,v:number):void}):boolean {
    if((bus.read8(0xff40)&0x80)===0){this.dots=0;this.line=0;this.statSignal=false;bus.write8(0xff44,0);return false;}
    this.dots+=cycles;let frame=false;
    while(this.dots>=456){this.dots-=456;this.line=(this.line+1)%154;if(this.line===144){bus.write8(0xff0f,bus.read8(0xff0f)|1);frame=true;}}
    bus.write8(0xff44,this.line);
    const mode=this.line>=144?1:this.dots<80?2:this.dots<252?3:0;
    const stat=(bus.read8(0xff41)&0xfc)|mode;bus.write8(0xff41,stat);
    const lyc=bus.read8(0xff45);const coincidence=this.line===lyc;
    bus.write8(0xff41,coincidence?stat|4:stat&~4);
    const signal=(coincidence&&(stat&0x40)!==0)||(mode===0&&(stat&8)!==0)||(mode===1&&(stat&0x10)!==0)||(mode===2&&(stat&0x20)!==0);
    if(signal&&!this.statSignal)bus.write8(0xff0f,bus.read8(0xff0f)|2);this.statSignal=signal;
    return frame;
  }
  public renderFrame(read: (address: number) => number): void {
    const lcdc=read(0xff40),bgp=read(0xff47),obp0=read(0xff48),obp1=read(0xff49);
    if((lcdc&0x80)===0){this.reset();return;}
    const unsigned=(lcdc&0x10)!==0,bgMap=(lcdc&8)?0x9c00:0x9800,winMap=(lcdc&0x40)?0x9c00:0x9800;
    this.bgIds.fill(0);
    for(let y=0;y<144;y++)for(let x=0;x<160;x++){
      const layerEnabled=(lcdc&1)!==0;const window=layerEnabled&&(lcdc&0x20)!==0&&y>=read(0xff4a)&&x>=read(0xff4b)-7;
      let px,py,map;
      if(window){px=x-(read(0xff4b)-7);py=y-read(0xff4a);map=winMap;}
      else{px=(x+read(0xff43))&255;py=(y+read(0xff42))&255;map=bgMap;}
      let id=0;if(layerEnabled){const tile=read(map+(py>>>3)*32+(px>>>3));const tileAddr=unsigned?0x8000+tile*16:0x9000+((tile<<24)>>24)*16;const row=(py&7)*2,bit=7-(px&7);const lo=read(tileAddr+row),hi=read(tileAddr+row+1);id=((lo>>>bit)&1)|(((hi>>>bit)&1)<<1);}this.bgIds[y*160+x]=id;this.setPixel(y*160+x,(bgp>>>(id*2))&3);
    }
    if((lcdc&2)===0)return;
    const height=(lcdc&4)?16:8;
    for(let y=0;y<144;y++){
      const sprites:number[]=[];for(let i=0;i<40&&sprites.length<10;i++){const sy=read(0xfe00+i*4)-16;if(y>=sy&&y<sy+height)sprites.push(i);}
      sprites.sort((a,b)=>read(0xfe01+a*4)-read(0xfe01+b*4)||a-b);
      const claimed=new Uint8Array(160);
      for(const i of sprites){const base=0xfe00+i*4,sy=read(base)-16,sx=read(base+1)-8;let tile=read(base+2);const attr=read(base+3);let row=y-sy;if(attr&0x40)row=height-1-row;if(height===16)tile&=0xfe;tile+=row>>>3;row&=7;const lo=read(0x8000+tile*16+row*2),hi=read(0x8001+tile*16+row*2);const palette=(attr&0x10)?obp1:obp0;
        for(let dx=0;dx<8;dx++){const x=sx+dx;if(x<0||x>=160||claimed[x])continue;const bit=(attr&0x20)?dx:7-dx;const id=((lo>>>bit)&1)|(((hi>>>bit)&1)<<1);if(id===0)continue;claimed[x]=1;if((attr&0x80)&&this.bgIds[y*160+x]!==0)continue;this.setPixel(y*160+x,(palette>>>(id*2))&3);}
      }
    }
  }
  private setPixel(index:number,n:number):void{const o=index*4,c=this.shade[n]!;this.frame[o]=c[0];this.frame[o+1]=c[1];this.frame[o+2]=c[2];this.frame[o+3]=255;}
}
