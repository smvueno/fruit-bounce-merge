import React from 'react';
import { FruitTier } from '../types';
import { FRUIT_DEFS } from '../constants';

export const FruitSVG: React.FC<{ tier: FruitTier, size: number }> = ({ tier, size }) => {
    const def = FRUIT_DEFS[tier] || FRUIT_DEFS[FruitTier.CHERRY];
    return <>{def.renderSvg(size)}</>;
};
