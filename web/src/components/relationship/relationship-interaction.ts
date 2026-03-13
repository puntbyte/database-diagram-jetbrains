// web/src/components/relationship/relationship-interaction.ts

type HighlightableElement = 'connection' | 'column' | 'table';

/*interface HighlightState {
  element: Element;
  type: HighlightableElement;
}*/

export class RelationshipInteraction {
  private activeHighlights: Set<Element> = new Set();
  private container: HTMLElement;
  private svgLayer: SVGSVGElement;

  constructor(container: HTMLElement, svgLayer: SVGSVGElement) {
    this.container = container;
    this.svgLayer = svgLayer;
  }

  bind(): void {
    this.container.addEventListener('mouseover', (e) => this.handleMouseOver(e));
    this.container.addEventListener('mouseout', (e) => this.handleMouseOut(e));
  }

  private handleMouseOver(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const highlightable = this.findHighlightableAncestor(target);

    if (highlightable) {
      this.activateHighlight(highlightable);
    }
  }

  private handleMouseOut(event: MouseEvent): void {
    const relatedTarget = event.relatedTarget as HTMLElement;

    // Only clear if we're not moving to another highlightable element
    if (!relatedTarget || !this.findHighlightableAncestor(relatedTarget)) {
      this.clearAllHighlights();
    }
  }

  private findHighlightableAncestor(element: HTMLElement): {
    element: HTMLElement; type: HighlightableElement
  } | null {
    const connection = element.closest('.relationship-group') as HTMLElement;
    if (connection) return {element: connection, type: 'connection'};

    const column = element.closest('.db-row') as HTMLElement;
    if (column?.id) return {element: column, type: 'column'};

    const table = element.closest('.db-table') as HTMLElement;
    if (table?.id) return {element: table, type: 'table'};

    return null;
  }

  private activateHighlight({element, type}: {
    element: HTMLElement; type: HighlightableElement
  }): void {
    this.clearAllHighlights();

    switch (type) {
      case 'connection':
        this.highlightConnection(element);
        break;
      case 'column':
        this.highlightColumn(element.id);
        break;
      case 'table':
        this.highlightTable(element.id);
        break;
    }
  }

  private highlightConnection(connectionGroup: HTMLElement): void {
    this.addHighlight(connectionGroup);

    const fromId = connectionGroup.dataset.from;
    const toId = connectionGroup.dataset.to;

    if (fromId) this.highlightElementById(fromId);
    if (toId) this.highlightElementById(toId);
    this.highlightAnchorPorts(fromId, toId);
  }

  private highlightColumn(columnId: string): void {
    this.highlightElementById(columnId);

    const connectedLines = this.svgLayer.querySelectorAll(
        `[data-from="${columnId}"], [data-to="${columnId}"]`
    );

    connectedLines.forEach(line => {
      this.addHighlight(line);
      const lineEl = line as HTMLElement;

      if (lineEl.dataset.from !== columnId) {
        this.highlightElementById(lineEl.dataset.from);
      }
      if (lineEl.dataset.to !== columnId) {
        this.highlightElementById(lineEl.dataset.to);
      }

      this.highlightAnchorPorts(lineEl.dataset.from, lineEl.dataset.to);
    });
  }

  private highlightTable(tableId: string): void {
    this.highlightElementById(tableId);

    const connectedLines = this.svgLayer.querySelectorAll(
        `[data-from-table="${tableId}"], [data-to-table="${tableId}"]`
    );

    connectedLines.forEach(line => {
      this.addHighlight(line);
      const lineEl = line as HTMLElement;
      this.highlightElementById(lineEl.dataset.from);
      this.highlightElementById(lineEl.dataset.to);
      this.highlightAnchorPorts(lineEl.dataset.from, lineEl.dataset.to);
    });
  }

  private highlightElementById(id: string | undefined): void {
    if (!id) return;
    const element = document.getElementById(id);
    if (element) this.addHighlight(element);
  }

  private highlightAnchorPorts(fromId?: string, toId?: string): void {
    [fromId, toId].forEach(id => {
      if (!id) return;
      const ports = this.svgLayer.querySelectorAll(`[data-anchor-id="${id}"]`);
      ports.forEach(port => this.addHighlight(port));
    });
  }

  private addHighlight(element: Element): void {
    element.classList.add('highlighted');
    this.activeHighlights.add(element);
  }

  private clearAllHighlights(): void {
    this.activeHighlights.forEach(el => el.classList.remove('highlighted'));
    this.activeHighlights.clear();
  }
}