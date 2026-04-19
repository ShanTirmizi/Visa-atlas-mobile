// components/trip/__tests__/DayDeck.physics.test.ts
import { DAY_DECK_PHYSICS } from '../DayDeck.constants';

function transformFor(offset: number, dragX: number, isCenter: boolean) {
  const translateX = offset * DAY_DECK_PHYSICS.offsetTranslate + (isCenter ? dragX : 0);
  const scale = 1 - Math.abs(offset) * DAY_DECK_PHYSICS.scalePerOffset;
  const opacity = 1 - Math.abs(offset) * DAY_DECK_PHYSICS.opacityPerOffset;
  const rotation = isCenter ? dragX * DAY_DECK_PHYSICS.rotationPerDragPx : 0;
  return { translateX, scale, opacity, rotation };
}

describe('DayDeck physics', () => {
  it('center at rest: no drag, scale=1, opacity=1, rotation=0', () => {
    expect(transformFor(0, 0, true)).toEqual({ translateX: 0, scale: 1, opacity: 1, rotation: 0 });
  });
  it('offset 1 (right neighbor): translateX=50, scale=0.93, opacity=0.7', () => {
    const t = transformFor(1, 0, false);
    expect(t.translateX).toBe(50);
    expect(t.scale).toBeCloseTo(0.93, 3);
    expect(t.opacity).toBeCloseTo(0.7, 3);
  });
  it('center dragged 100px: rotation = 1.5 degrees', () => {
    expect(transformFor(0, 100, true).rotation).toBe(1.5);
  });
  it('commit threshold is 60px', () => {
    expect(DAY_DECK_PHYSICS.commitThresholdPx).toBe(60);
  });
});
