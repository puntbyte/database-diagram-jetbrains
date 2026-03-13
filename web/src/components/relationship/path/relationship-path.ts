// web/src/components/relationship/path/relationship-path.ts

import type { Rect, ConnectionPathData, LineStyle, EndpointsConfig } from '../types.ts';
import { PathGeometer } from './path-geometer.ts';
import { PathComposer } from './path-composer.ts';
import { LabelPlacer } from './label-placer.ts';

export class RelationshipPath {
  private readonly geometryCalc: PathGeometer;
  private readonly commandGen: PathComposer;
  private readonly labelCalc: LabelPlacer;

  constructor() {
    this.geometryCalc = new PathGeometer();
    this.commandGen = new PathComposer();
    this.labelCalc = new LabelPlacer();
  }

  calculate(
      fromRect: Rect,
      toRect: Rect,
      fromId: string,
      toId: string,
      fromTableId: string,
      toTableId: string,
      style: LineStyle,
      config: EndpointsConfig
  ): ConnectionPathData {
    const geometry = this.geometryCalc.calculate(fromRect, toRect, config, style);
    const pathCommand = this.commandGen.generate(geometry, style);
    const labels = this.labelCalc.calculate(geometry, config);

    return {
      d: pathCommand,
      start: geometry.start,
      end: geometry.end,
      labelStart: { text: config.fromLabel, pos: labels.start },
      labelEnd: { text: config.toLabel, pos: labels.end },
      fromId,
      toId,
      fromTableId,
      toTableId
    };
  }
}