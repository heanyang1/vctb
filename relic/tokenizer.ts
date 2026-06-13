export class LispNumber {
  constructor(
    public readonly isInt: boolean,
    public readonly intVal: number,
    public readonly floatVal: number,
  ) {}

  static fromInt(n: number): LispNumber {
    return new LispNumber(true, n, n);
  }

  static fromFloat(n: number): LispNumber {
    return new LispNumber(false, Math.trunc(n), n);
  }

  toNumber(): number {
    return this.isInt ? this.intVal : this.floatVal;
  }

  toString(): string {
    return this.isInt ? String(this.intVal) : String(this.floatVal);
  }

  add(other: LispNumber): LispNumber {
    if (this.isInt && other.isInt) return LispNumber.fromInt(this.intVal + other.intVal);
    return LispNumber.fromFloat(this.toNumber() + other.toNumber());
  }

  sub(other: LispNumber): LispNumber {
    if (this.isInt && other.isInt) return LispNumber.fromInt(this.intVal - other.intVal);
    return LispNumber.fromFloat(this.toNumber() - other.toNumber());
  }

  mul(other: LispNumber): LispNumber {
    if (this.isInt && other.isInt) return LispNumber.fromInt(this.intVal * other.intVal);
    return LispNumber.fromFloat(this.toNumber() * other.toNumber());
  }

  div(other: LispNumber): LispNumber {
    return LispNumber.fromFloat(this.toNumber() / other.toNumber());
  }

  eq(other: LispNumber): boolean {
    return this.toNumber() === other.toNumber();
  }

  lt(other: LispNumber): boolean {
    return this.toNumber() < other.toNumber();
  }

  gt(other: LispNumber): boolean {
    return this.toNumber() > other.toNumber();
  }

  le(other: LispNumber): boolean {
    return this.toNumber() <= other.toNumber();
  }

  ge(other: LispNumber): boolean {
    return this.toNumber() >= other.toNumber();
  }
}

export enum TokenTypeKind {
  LParen,
  RParen,
  Quote,
  Dot,
  Number,
  Symbol,
  Comment,
}

export class TokenType {
  constructor(
    public readonly kind: TokenTypeKind,
    public readonly value?: string | LispNumber,
  ) {}

  static lParen(): TokenType { return new TokenType(TokenTypeKind.LParen); }
  static rParen(): TokenType { return new TokenType(TokenTypeKind.RParen); }
  static quote(): TokenType { return new TokenType(TokenTypeKind.Quote); }
  static dot(): TokenType { return new TokenType(TokenTypeKind.Dot); }
  static number(n: LispNumber): TokenType { return new TokenType(TokenTypeKind.Number, n); }
  static symbol(s: string): TokenType { return new TokenType(TokenTypeKind.Symbol, s); }
  static comment(): TokenType { return new TokenType(TokenTypeKind.Comment); }
}

export class Lexer {
  private raw: string;
  private curPos: number;

  constructor(s: string) {
    this.raw = s;
    this.curPos = 0;
  }

  getCurPos(): number {
    return this.curPos;
  }

  private isWhitespace(x: string): boolean {
    return x === ' ' || x === '\n' || x === '\t' || x === '\r';
  }

  private isSpecialChar(x: string): boolean {
    return x === '(' || x === ')' || x === '\'' || this.isWhitespace(x);
  }

  consumeSymbol(): string {
    const token = this.next();
    if (token && token.kind === TokenTypeKind.Symbol) {
      return token.value as string;
    }
    throw new Error(`At position ${this.getCurPos()}: Expected symbol, found ${JSON.stringify(token)}`);
  }

  peekNextToken(): { pos: number; token: TokenType | null } {
    let curPos = this.curPos;
    while (curPos < this.raw.length && this.isWhitespace(this.raw[curPos])) {
      curPos++;
    }
    if (curPos >= this.raw.length) return { pos: curPos, token: null };

    const ch = this.raw[curPos];
    switch (ch) {
      case '(': return { pos: curPos + 1, token: TokenType.lParen() };
      case ')': return { pos: curPos + 1, token: TokenType.rParen() };
      case '\'': return { pos: curPos + 1, token: TokenType.quote() };
      case '.': return { pos: curPos + 1, token: TokenType.dot() };
      case '"': {
        let nextPos = curPos + 1;
        while (nextPos < this.raw.length && this.raw[nextPos] !== '"') nextPos++;
        const str = this.raw.slice(curPos + 1, nextPos);
        return { pos: nextPos + 1, token: TokenType.symbol(str) };
      }
      case ';': {
        let nextPos = curPos + 1;
        while (nextPos < this.raw.length && this.raw[nextPos] !== '\n') nextPos++;
        return { pos: nextPos + 1, token: TokenType.comment() };
      }
      default: {
        if (/[0-9]/.test(ch)) {
          return this.peekNumber(curPos);
        }
        return this.peekSymbol(curPos);
      }
    }
  }

  private peekSymbol(curPos: number): { pos: number; token: TokenType | null } {
    let symbol = '';
    while (curPos < this.raw.length && !this.isSpecialChar(this.raw[curPos])) {
      symbol += this.raw[curPos];
      curPos++;
    }
    return { pos: curPos, token: TokenType.symbol(symbol) };
  }

  private peekNumber(pos: number): { pos: number; token: TokenType | null } {
    let curPos = pos;
    while (curPos < this.raw.length && /[0-9.]/.test(this.raw[curPos])) {
      curPos++;
    }
    const numStr = this.raw.slice(pos, curPos);
    if (numStr === '') return { pos: curPos, token: null };
    if (numStr.includes('.')) {
      const val = parseFloat(numStr);
      return { pos: curPos, token: TokenType.number(LispNumber.fromFloat(val)) };
    }
    const val = parseInt(numStr, 10);
    return { pos: curPos, token: TokenType.number(LispNumber.fromInt(val)) };
  }

  next(): TokenType | null {
    const { pos, token } = this.peekNextToken();
    this.curPos = pos;
    return token;
  }
}
