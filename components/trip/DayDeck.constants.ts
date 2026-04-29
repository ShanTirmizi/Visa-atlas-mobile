export const DAY_DECK_PHYSICS = {
  offsetTranslate: 50,      // translateX = offset * 50
  scalePerOffset: 0.07,     // scale = 1 - |offset| * 0.07
  opacityPerOffset: 0.3,    // opacity = 1 - |offset| * 0.3
  rotationPerDragPx: 0.015, // rotation(deg) = dragX * 0.015
  commitThresholdPx: 60,    // drag distance to commit
  springConfig: {
    // cubic-bezier(0.22, 1, 0.36, 1) 0.4s → approximate with Reanimated withSpring
    damping: 22,
    stiffness: 180,
    mass: 1,
  },
  visibleSideCards: 2,       // render up to ±2 from center
} as const;
