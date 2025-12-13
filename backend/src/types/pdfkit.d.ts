declare module 'pdfkit' {
  interface PDFDocumentOptions {
    size?: string | [number, number];
    margin?: number;
    autoFirstPage?: boolean;
    bufferPages?: boolean;
    [key: string]: any;
  }

  interface TextOptions {
    align?: 'left' | 'center' | 'right' | 'justify';
    width?: number;
    height?: number;
    indent?: number;
    columns?: number;
    columnGap?: number;
    lineBreak?: boolean;
    ellipsis?: boolean | string;
    baseline?: 'alphabetic' | 'ideographic' | 'hanging' | 'mathematical';
    paragraphGap?: number;
    underline?: boolean;
    strike?: boolean;
    link?: string;
    continued?: boolean;
    features?: any[];
    oblique?: boolean;
    bold?: boolean;
    [key: string]: any;
  }

  interface PDFDocument {
    // Propriétés
    x: number;
    y: number;
    page: {
      height: number;
      width: number;
      margins?: { top: number; bottom: number; left: number; right: number };
    };
    
    // Méthodes
    pipe(stream: any): this;
    end(): void;
    addPage(options?: any): this;
    
    text(text: string, x?: number, y?: number, options?: TextOptions): this;
    text(text: string, options?: TextOptions): this;
    fontSize(size: number): this;
    font(src: string, size?: number): this;
    fillColor(color: string): this;
    strokeColor(color: string): this;
    
    lineWidth(width: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(): this;
    stroke(color?: string): this;
    rect(x: number, y: number, width: number, height: number): this;
    fill(color?: string): this;
    fillAndStroke(fill: string, stroke: string): this;
    
    moveDown(y?: number): this;
    moveUp(y?: number): this;
    
    save(): this;
    restore(): this;
  }

  const PDFDocument: {
    new (options?: PDFDocumentOptions): PDFDocument;
  };
  
  export default PDFDocument;
}

// Déclaration du namespace PDFKit pour la compatibilité
declare namespace PDFKit {
  export type PDFDocument = import('pdfkit').default;
}