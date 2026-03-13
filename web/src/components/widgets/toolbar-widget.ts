// web/src/components/widgets/toolbar-widget.ts

import type {ViewportController} from '../../interactions/viewport-controller.ts';
import {Icons} from '../ui/icons.ts';

const CSS_CLASSES = {
  toolbar: 'toolbar-widget',
  controlsGroup: 'toolbar-controls-group',
  controlButton: 'toolbar-control-btn',
  icon: 'toolbar-icon'
} as const;

interface ControlConfig {
  icon: string;
  title: string;
  action: () => void;
}

export class ToolbarWidget {
  private readonly container: HTMLElement;
  private readonly toolbarElement: HTMLElement;
  private readonly viewport: ViewportController;

  constructor(
      container: HTMLElement,
      viewport: ViewportController
  ) {
    this.container = container;
    this.viewport = viewport;
    this.toolbarElement = this.createToolbar();
    this.render();
  }

  private createToolbar(): HTMLElement {
    const el = document.createElement('div');
    el.className = CSS_CLASSES.toolbar;
    return el;
  }

  private render(): void {
    const zoomGroup = this.createZoomControls();
    this.toolbarElement.appendChild(zoomGroup);
    this.container.appendChild(this.toolbarElement);
  }

  private createZoomControls(): HTMLElement {
    const group = document.createElement('div');
    group.className = CSS_CLASSES.controlsGroup;

    const controls: ControlConfig[] = [
      {icon: Icons.zoomOut, title: 'Zoom Out', action: () => this.viewport.zoomOut()},
      {icon: Icons.center, title: 'Reset View', action: () => this.viewport.resetView()},
      {icon: Icons.zoomIn, title: 'Zoom In', action: () => this.viewport.zoomIn()}
    ];

    const buttons = controls.map(config => this.createButton(config));
    group.append(...buttons);

    return group;
  }

  private createButton(config: ControlConfig): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = CSS_CLASSES.controlButton;
    button.innerHTML = config.icon;
    button.title = config.title;
    button.addEventListener('click', config.action);
    return button;
  }

  destroy(): void {
    this.toolbarElement.remove();
  }
}