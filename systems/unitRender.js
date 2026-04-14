function renderUnitSystem(units, ctx, debug = {}) {
  for (const unit of units) {
    if (window.UnitComponents && window.UnitComponents.render) {
      const renderComp = window.UnitComponents.render.get(unit.id);
      if (renderComp) {
        renderComp.selected = unit.selected;
        renderComp.spriteFrame = unit.spriteFrame;
        renderComp.facing = unit.spriteDirectionRow;
      }
    }

    processUnitRender(unit, ctx);

    if (debug.showPaths) unit.renderPath(ctx);
    if (debug.showRawPaths) unit.renderRawPath(ctx);
    if (debug.showIllegalMoves) unit.renderIllegalMoves(ctx);
  }
}

