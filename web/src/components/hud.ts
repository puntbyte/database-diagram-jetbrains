import type {PanZoomManager} from '../interactions/panzoom-manager';
import type {ConnectionManager} from './connection/manager';
import type {LineStyle} from "./connection/types.ts";
import {Icons} from './icons'; // Import Icons

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

        // 1. Grid toggle
        const gridGroup = document.createElement('div');
        gridGroup.className = 'hud-group';

        // Use SVG icon
        const gridBtn = this.createButton(Icons.Grid, 'Toggle Grid');

        const isGridOn = container.classList.contains('grid-visible');
        gridBtn.dataset.state = isGridOn ? 'on' : 'off';
        if (isGridOn) gridBtn.classList.add('active');

        gridBtn.onclick = () => {
            const state = gridBtn.dataset.state === 'on';
            const newState = !state;
            gridBtn.dataset.state = newState ? 'on' : 'off';
            gridBtn.classList.toggle('active', newState);

            if (newState) this.container.classList.add('grid-visible');
            else this.container.classList.remove('grid-visible');

            this.dispatchProjectSettingsChange({showGrid: newState});
        };

        gridGroup.appendChild(gridBtn);

        // 2. Line Style Dropdown
        const styleGroup = document.createElement('div');
        styleGroup.className = 'hud-group';

        const options: { value: LineStyle, text: string }[] = [
            {value: 'Curve', text: 'Curve'},
            {value: 'Rectilinear', text: 'Rectilinear'},
            {value: 'RoundRectilinear', text: 'Round Rectilinear'},
            {value: 'Oblique', text: 'Oblique'},
            {value: 'RoundOblique', text: 'Round Oblique'},
        ];

        const customSelect = document.createElement('div');
        customSelect.className = 'custom-select';

        const trigger = document.createElement('div');
        trigger.className = 'select-trigger';
        trigger.title = "Connection Line Style";

        // Add text span
        const triggerText = document.createElement('span');
        triggerText.innerText = 'Curve';
        trigger.appendChild(triggerText);

        // Add SVG Arrow
        const triggerArrow = document.createElement('div');
        triggerArrow.className = 'select-arrow';
        triggerArrow.innerHTML = Icons.ChevronUp; // Use imported SVG
        trigger.appendChild(triggerArrow);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'select-options';

        trigger.onclick = (e) => {
            e.stopPropagation();
            customSelect.classList.toggle('open');
        };

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
                triggerText.innerText = opt.text; // Update text span
                customSelect.querySelectorAll('.select-option').forEach(el => el.classList.remove('selected'));
                optEl.classList.add('selected');
                customSelect.classList.remove('open');

                connectionManager.setLineStyle(opt.value);
                this.dispatchProjectSettingsChange({lineStyle: opt.value});
            };

            if (opt.value === 'Curve') optEl.classList.add('selected');
            optionsContainer.appendChild(optEl);
        });

        customSelect.appendChild(trigger);
        customSelect.appendChild(optionsContainer);
        styleGroup.appendChild(customSelect);

        // 3. Zoom Controls
        const zoomGroup = document.createElement('div');
        zoomGroup.className = 'hud-group';

        const btnIn = this.createButton(Icons.ZoomIn, 'Zoom In');
        btnIn.onclick = () => panZoom.zoomIn();

        const btnOut = this.createButton(Icons.ZoomOut, 'Zoom Out');
        btnOut.onclick = () => panZoom.zoomOut();

        const btnFit = this.createButton(Icons.Center, 'Reset View');
        btnFit.onclick = () => panZoom.resetView();

        zoomGroup.append(btnOut, btnFit, btnIn);

        this.el.append(gridGroup, styleGroup, zoomGroup);
        container.appendChild(this.el);
    }

    // Changed signature to accept HTML string (SVG)
    private createButton(iconHtml: string, title: string): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.className = 'hud-btn';
        btn.innerHTML = iconHtml; // Use innerHTML for SVG
        btn.title = title;
        return btn;
    }

    private dispatchProjectSettingsChange(partial: Partial<{
        lineStyle: LineStyle;
        showGrid: boolean;
        zoom: number;
        panX: number;
        panY: number
    }>) {
        const ev = new CustomEvent('project-settings-changed', {detail: partial});
        this.container.dispatchEvent(ev);
    }
}