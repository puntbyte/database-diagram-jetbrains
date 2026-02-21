import type {PanZoomManager} from '../interactions/panzoom-manager';
import type {ConnectionManager} from './connection/manager';
import type {LineStyle} from "./connection/types.ts";

export class HUDComponent {
  private el: HTMLElement;
  private container: HTMLElement;

  constructor(
      container: HTMLElement,
      panZoom: PanZoomManager,
      connectionManager: ConnectionManager
  ) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'schema-hud';

    // 1. Grid toggle button (group)
    const gridGroup = document.createElement('div');
    gridGroup.className = 'hud-group';

    const gridBtn = this.createButton('▓', 'Toggle Grid');
    // Check initial state from container class
    const isGridOn = container.classList.contains('grid-visible');
    gridBtn.dataset.state = isGridOn ? 'on' : 'off';
    if(isGridOn) gridBtn.classList.add('active');

    gridBtn.onclick = () => {
      const state = gridBtn.dataset.state === 'on';
      const newState = !state;
      gridBtn.dataset.state = newState ? 'on' : 'off';
      gridBtn.classList.toggle('active', newState);

      // Toggle CSS class on the main CONTAINER (#app), not the wrapper
      if (newState) this.container.classList.add('grid-visible');
      else this.container.classList.remove('grid-visible');

      this.dispatchProjectSettingsChange({ showGrid: newState });
    };

    gridGroup.appendChild(gridBtn);

    // 2. Line Style Dropdown (group) - CUSTOM UPWARD DROPDOWN
    const styleGroup = document.createElement('div');
    styleGroup.className = 'hud-group';

    const options: { value: LineStyle, text: string }[] = [
      {value: 'Curve', text: 'Curve'},
      {value: 'Rectilinear', text: 'Rectilinear'},
      {value: 'RoundRectilinear', text: 'Round Rectilinear'},
      {value: 'Oblique', text: 'Oblique'},
      {value: 'RoundOblique', text: 'Round Oblique'},
    ];

    // Create custom select structure
    const customSelect = document.createElement('div');
    customSelect.className = 'custom-select';

    const trigger = document.createElement('div');
    trigger.className = 'select-trigger';
    trigger.innerText = 'Curve'; // Default
    trigger.title = "Connection Line Style";

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'select-options';

    // Toggle dropdown open/close
    trigger.onclick = (e) => {
      e.stopPropagation();
      customSelect.classList.toggle('open');
    };

    // Close when clicking outside
    window.addEventListener('click', (e) => {
      if (!customSelect.contains(e.target as Node)) {
        customSelect.classList.remove('open');
      }
    });

    options.forEach(opt => {
      const optEl = document.createElement('div');
      optEl.className = 'select-option';
      optEl.innerText = opt.text;

      optEl.onclick = () => {
        // Update UI
        trigger.innerText = opt.text;
        customSelect.querySelectorAll('.select-option').forEach(el => el.classList.remove('selected'));
        optEl.classList.add('selected');
        customSelect.classList.remove('open');

        // Logic
        connectionManager.setLineStyle(opt.value);
        this.dispatchProjectSettingsChange({ lineStyle: opt.value });
      };

      if (opt.value === 'Curve') optEl.classList.add('selected'); // Initial state check could be better but defaults to Curve
      optionsContainer.appendChild(optEl);
    });

    customSelect.appendChild(trigger);
    customSelect.appendChild(optionsContainer);
    styleGroup.appendChild(customSelect);

    // 3. Zoom Controls (group)
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'hud-group';

    const btnIn = this.createButton('+', 'Zoom In');
    btnIn.onclick = () => panZoom.zoomIn();

    const btnOut = this.createButton('−', 'Zoom Out');
    btnOut.onclick = () => panZoom.zoomOut();

    const btnFit = this.createButton('⌂', 'Reset View');
    btnFit.onclick = () => panZoom.resetView();

    zoomGroup.append(btnOut, btnFit, btnIn);

    // Append Groups (Horizontal order: Grid -> Style -> Zoom)
    this.el.append(gridGroup, styleGroup, zoomGroup);
    container.appendChild(this.el);
  }

  private createButton(text: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'hud-btn';
    btn.innerText = text;
    btn.title = title;
    return btn;
  }

  private dispatchProjectSettingsChange(partial: Partial<{ lineStyle: LineStyle; showGrid: boolean; zoom: number; panX: number; panY: number }>) {
    const ev = new CustomEvent('project-settings-changed', { detail: partial });
    this.container.dispatchEvent(ev);
  }
}