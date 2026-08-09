import sharkPage from './shark.js';
import { stubPage } from './stub.js';

// ============================================================
//  PAGE REGISTRY  — array order is tab order.
//
//  A page is { id, title, mount(el), enter(), exit() }.
//    mount  runs ONCE, the first time its tab is opened
//    enter  runs every time it becomes visible — start loops here
//    exit   runs every time it is hidden — stop everything you started
//
//  That split is the whole contract: anything expensive (a renderer, a model, a
//  big DOM tree) is built in mount and merely started and stopped after, which
//  is what keeps the fifth open as cheap as the second.
// ============================================================

export const PAGES = [
  sharkPage,
  stubPage('map', 'Map', 'An overhead chart of the shallows, the canyon and the reef.'),
  stubPage('missions', 'Missions', 'Hunts and objectives with a reward for finishing them.'),
  stubPage('quests', 'Quests', 'The longer thread that ties the missions together.'),
];
