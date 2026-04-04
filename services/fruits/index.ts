import { FruitTier, FruitDef } from './shared';
import { CHERRY } from './cherry';
import { STRAWBERRY } from './strawberry';
import { GRAPE } from './grape';
import { CLEMENTINE } from './clementine';
import { ORANGE } from './orange';
import { APPLE } from './apple';
import { PINEAPPLE } from './pineapple';
import { COCONUT } from './coconut';
import { PUMPKIN } from './pumpkin';
import { WATERMELON } from './watermelon';
import { TOMATO } from './tomato';
import { RAINBOW } from './rainbow';
import { BOMB } from './bomb';

export { FruitTier } from './shared';
export type { FruitDef } from './shared';
export { CHERRY } from './cherry';
export { STRAWBERRY } from './strawberry';
export { GRAPE } from './grape';
export { CLEMENTINE } from './clementine';
export { ORANGE } from './orange';
export { APPLE } from './apple';
export { PINEAPPLE } from './pineapple';
export { COCONUT } from './coconut';
export { PUMPKIN } from './pumpkin';
export { WATERMELON } from './watermelon';
export { TOMATO } from './tomato';
export { RAINBOW } from './rainbow';
export { BOMB } from './bomb';

export const FRUIT_DEFS: Record<FruitTier, FruitDef> = {
    [FruitTier.CHERRY]: CHERRY,
    [FruitTier.STRAWBERRY]: STRAWBERRY,
    [FruitTier.GRAPE]: GRAPE,
    [FruitTier.CLEMENTINE]: CLEMENTINE,
    [FruitTier.ORANGE]: ORANGE,
    [FruitTier.APPLE]: APPLE,
    [FruitTier.PINEAPPLE]: PINEAPPLE,
    [FruitTier.COCONUT]: COCONUT,
    [FruitTier.PUMPKIN]: PUMPKIN,
    [FruitTier.WATERMELON]: WATERMELON,
    [FruitTier.TOMATO]: TOMATO,
    [FruitTier.RAINBOW]: RAINBOW,
    [FruitTier.BOMB]: BOMB,
};
