import type {Parser} from './parser-interface';
import {DbmlParser} from '../parsers/dbml/';
import {TableComponent} from '../components/table';
import {ConnectionManager} from '../components/connection/manager';
import {DragManager, type OnTableUpdateCallback} from '../interactions/drag-manager';
import {PanZoomManager} from '../interactions/panzoom-manager';
import {HUDComponent} from '../components/hud';

export class SchemaRenderer {
    private container: HTMLElement;
    private wrapper: HTMLElement;
    private connectionManager: ConnectionManager;
    private dragManager: DragManager;
    private panZoomManager: PanZoomManager;
    private hud: HUDComponent;

    private parsers: Record<string, Parser> = {
        'dbml': new DbmlParser(),
    };

    constructor(containerId: string, onTableMove: OnTableUpdateCallback, onTransform?: (scale:number,x:number,y:number) => void) {
        this.container = document.getElementById(containerId)!;
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'schema-wrapper';
        this.container.appendChild(this.wrapper);

        this.connectionManager = new ConnectionManager(this.wrapper);
        this.dragManager = new DragManager(this.wrapper, this.connectionManager, onTableMove);

        this.panZoomManager = new PanZoomManager(this.wrapper,
            (scale) => {
                this.updateZoomState(scale);
                this.dragManager.updateScale(scale);
                this.connectionManager.updateScale(scale);
            },
            (scale, x, y) => {
                this.updateZoomState(scale, x, y);
                this.dragManager.updateScale(scale);
                this.connectionManager.updateScale(scale);
                if (onTransform) onTransform(scale, x, y);
            }
        );

        this.hud = new HUDComponent(this.container, this.panZoomManager, this.connectionManager);
    }

    // Consolidated Zoom State Logic
    private updateZoomState(scale: number, x?: number, y?: number) {
        // Threshold to switch to solid block overlay
        const THRESHOLD = 0.5;

        if (scale < THRESHOLD) {
            this.wrapper.classList.add('semantic-zoom');
        } else {
            this.wrapper.classList.remove('semantic-zoom');
        }

        // Critical for the font-size calculation in CSS
        this.container.style.setProperty('--zoom', scale.toString());

        if (x !== undefined && y !== undefined) {
            this.container.style.setProperty('--pan-x', `${x}px`);
            this.container.style.setProperty('--pan-y', `${y}px`);
        }
    }

    public render(format: string, content: string) {
        // 1. Clear previous content
        this.wrapper.innerHTML = '';

        // 2. Reset connection manager
        this.connectionManager = new ConnectionManager(this.wrapper);
        this.dragManager.updateConnectionManager(this.connectionManager);

        // 3. Sync initial state from PanZoom (which defaults to centered 0,0)
        const currentTransform = this.panZoomManager.getTransform();
        this.connectionManager.updateScale(currentTransform.scale);
        this.dragManager.updateScale(currentTransform.scale);
        this.updateZoomState(currentTransform.scale);

        // 4. Reset HUD
        this.container.querySelector('.schema-hud')?.remove();
        this.hud = new HUDComponent(this.container, this.panZoomManager, this.connectionManager);

        // 5. Force update CSS variables so Grid matches the initial "Centered" state
        this.container.style.setProperty('--zoom', currentTransform.scale.toString());
        this.container.style.setProperty('--pan-x', `${currentTransform.x}px`);
        this.container.style.setProperty('--pan-y', `${currentTransform.y}px`);

        if (!content.trim()) return;

        try {
            let fmtKey = (format || '').toLowerCase().trim();
            if (fmtKey.startsWith('.')) fmtKey = fmtKey.slice(1);

            const parser = this.parsers[fmtKey];
            if (!parser) throw new Error(`Unsupported format: ${format}`);

            // Parse content
            const {tables, relationships, projectSettings} = parser.parse(content);

            // --- APPLY PROJECT SETTINGS ---
            if (projectSettings) {
                // A. Restore Zoom/Pan if saved
                if (projectSettings.zoom !== undefined || projectSettings.panX !== undefined) {
                    const s = projectSettings.zoom || 1;
                    const x = projectSettings.panX || 0;
                    const y = projectSettings.panY || 0;

                    this.panZoomManager.setTransform(s, x, y);

                    // Update CSS variables immediately to prevent visual jumping
                    this.container.style.setProperty('--zoom', s.toString());
                    this.container.style.setProperty('--pan-x', `${x}px`);
                    this.container.style.setProperty('--pan-y', `${y}px`);
                }

                // B. Restore Grid Visibility
                // We apply the class to the CONTAINER to show the background grid
                const showGrid = projectSettings.showGrid === 'true' || projectSettings.showGrid === true;
                if (showGrid) {
                    this.container.classList.add('grid-visible');
                } else {
                    this.container.classList.remove('grid-visible');
                }

                // Update HUD button state manually (since HUD is DOM-based)
                const gridBtn = this.container.querySelector('.hud-btn[title="Toggle Grid"]') as HTMLElement;
                if (gridBtn) {
                    gridBtn.dataset.state = showGrid ? 'on' : 'off';
                    if (showGrid) gridBtn.classList.add('active');
                    else gridBtn.classList.remove('active');
                }

                // C. Restore Line Style
                if (projectSettings.lineStyle) {
                    this.connectionManager.setLineStyle(projectSettings.lineStyle as any);

                    // Update HUD Dropdown UI text
                    const trigger = this.container.querySelector('.select-trigger');
                    const options = this.container.querySelectorAll('.select-option');
                    if (trigger && options.length) {
                        trigger.textContent = projectSettings.lineStyle;
                        options.forEach(opt => {
                            if (opt.textContent === projectSettings.lineStyle) opt.classList.add('selected');
                            else opt.classList.remove('selected');
                        });
                    }
                }
            }

            // Render Tables
            const gapX = 350;
            const gapY = 300;
            const cols = 3;

            tables.forEach((table, index) => {
                const tableEl = TableComponent.create(table);
                this.wrapper.appendChild(tableEl);

                // Position: Use stored x/y, or calculate default layout relative to (0,0)
                let left = (table.x !== undefined) ? table.x : (50 + (index % cols) * gapX);
                let top = (table.y !== undefined) ? table.y : (50 + Math.floor(index / cols) * gapY);

                tableEl.style.left = `${left}px`;
                tableEl.style.top = `${top}px`;

                if (table.width) tableEl.style.width = `${table.width}px`;

                if (table.color) {
                    const headerEl = tableEl.querySelector('.db-table-header') as HTMLElement;
                    if (headerEl) headerEl.style.backgroundColor = table.color;
                }
            });

            this.dragManager.setRelationships(relationships);

            // Draw connections after a tick to ensure DOM elements are sized/positioned
            setTimeout(() => {
                this.connectionManager.draw(relationships);
            }, 0);

        } catch (e: any) {
            console.error(e);
            this.wrapper.innerHTML = `<div class="error" style="padding:20px; color:red;">Error: ${e.message}</div>`;
        }
    }
}