import { describe, expect, it } from 'vitest';
import { findRoute, type NavigationPoint } from './navigation';

describe('tap-to-move navigation', () => {
  it('routes around a trunk while keeping the heroine body clear', () => {
    const start = {x:120,y:160};
    const blocker = {x:190,y:80,width:70,height:160};
    const route = findRoute(start,{x:340,y:160},[blocker],{width:500,height:400});
    expect(route.length).toBeGreaterThan(1);
    expect(route.at(-1)).toEqual({x:340,y:160});
    let previous: NavigationPoint = start;
    for(const point of route) {
      for(let step=0;step<=100;step++) {
        const x=previous.x+(point.x-previous.x)*step/100;
        const y=previous.y+(point.y-previous.y)*step/100;
        expect(x>blocker.x-17&&x<blocker.x+blocker.width+17&&y>blocker.y-17&&y<blocker.y+blocker.height+17).toBe(false);
      }
      previous=point;
    }
  });

  it('moves a tap inside a ruin to an accessible nearby destination', () => {
    const blocker={x:220,y:140,width:90,height:100};
    const route=findRoute({x:110,y:190},{x:250,y:190},[blocker],{width:500,height:400});
    expect(route.length).toBeGreaterThan(0);
    const goal=route.at(-1)!;
    expect(goal.x<202||goal.x>328||goal.y<122||goal.y>258).toBe(true);
  });

  it('returns no route through a sealed wall', () => {
    const route=findRoute({x:110,y:190},{x:380,y:190},[{x:235,y:0,width:35,height:400}],{width:500,height:400});
    expect(route).toEqual([]);
  });
});
