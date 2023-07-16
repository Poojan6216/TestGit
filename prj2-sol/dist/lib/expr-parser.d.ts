import { Result } from 'cs544-js-utils';
/************************* Top Level Functions *************************/
export default function parseExpr(expr: string, base?: CellRef | string): Result<Ast>;
/********************** Abstract Syntax Tree Types *********************/
type Op = keyof typeof OPS;
type Fn = 'max' | 'min';
declare class RefAst {
    readonly kind: 'ref';
    readonly value: CellRef;
    constructor(value: CellRef);
    prec(): number;
    toText(baseCell: CellRef): string;
}
declare class NumAst {
    readonly kind: 'num';
    readonly value: number;
    constructor(value: number);
    prec(): number;
    toText(baseCell: CellRef): string;
}
declare class AppAst {
    readonly kind: 'app';
    readonly fn: Op | Fn;
    readonly kids: Ast[];
    constructor(fn: Op | Fn, kids: Ast[]);
    prec(): number;
    toText(baseCell: CellRef): string;
    private static left;
    private static right;
}
export type Ast = RefAst | NumAst | AppAst;
/******************************* Scanner *******************************/
type Token = {
    kind: string;
    lexeme: string;
    value?: number | CellRef;
};
declare function scan(str: string, baseCell: CellRef): Result<Token[]>;
export { scan };
/**************************** Cell Reference ***************************/
declare class Coord {
    readonly index: number;
    readonly isAbs: boolean;
    constructor(index: number, isAbs: boolean);
}
export declare class CellRef {
    readonly col: Coord;
    readonly row: Coord;
    constructor(col: Coord, row: Coord);
    /** validate and parse ref-string relative to baseCell */
    static parse(ref: string, baseCell?: CellRef): Result<CellRef>;
    /** parse ref-string wrt baseCell; assumes ref is valid */
    static parseRef(ref: string, baseCell?: CellRef): CellRef;
    toText(baseCell?: CellRef): string;
}
declare const OPS: {
    '+': {
        fn: string;
        prec: number;
        assoc: string;
    };
    '-': {
        fn: string;
        prec: number;
        assoc: string;
    };
    '*': {
        fn: string;
        prec: number;
        assoc: string;
    };
    '/': {
        fn: string;
        prec: number;
        assoc: string;
    };
};
//# sourceMappingURL=expr-parser.d.ts.map