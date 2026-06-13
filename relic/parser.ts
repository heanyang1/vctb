import { Lexer, TokenTypeKind } from './tokenizer.js';
import { NodeData, NodeRef, nilNode, nilRef, ref, pairRef } from './node.js';
import { SpecialForm, specialFormFromString, BuiltinSymbol, makeSymbol } from './symbol.js';

export class ParseError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ParseError';
  }
}

export function parse(tokens: Lexer): NodeData {
  const tok = tokens.next();
  if (tok === null) throw new ParseError('Unexpected EOF');

  switch (tok.kind) {
    case TokenTypeKind.LParen: {
      const peek = tokens.peekNextToken().token;
      if (peek && peek.kind === TokenTypeKind.Symbol) {
        const form = specialFormFromString(peek.value as string);
        if (form !== null) {
          tokens.consumeSymbol();
          return {
            type: 'pair',
            car: ref({ type: 'specialForm', form }),
            cdr: ref(parseList(tokens)),
          };
        }
      }
      return parseList(tokens);
    }
    case TokenTypeKind.Quote: {
      return {
        type: 'pair',
        car: ref({ type: 'specialForm', form: SpecialForm.Quote }),
        cdr: ref({ type: 'pair', car: ref(parse(tokens)), cdr: nilRef() }),
      };
    }
    case TokenTypeKind.Number:
      return { type: 'number', num: tok.value as any };
    case TokenTypeKind.Symbol:
      return { type: 'symbol', sym: makeSymbol(tok.value as string) };
    case TokenTypeKind.RParen:
      throw new ParseError(`At position ${tokens.getCurPos()}: Unexpected ")"`);
    case TokenTypeKind.Dot:
      throw new ParseError(`At position ${tokens.getCurPos()}: Unexpected "."`);
    case TokenTypeKind.Comment:
      return parse(tokens);
  }
}

function parseList(tokens: Lexer): NodeData {
  const peek = tokens.peekNextToken().token;
  if (peek === null) throw new ParseError('Unexpected EOF in list');
  if (peek.kind === TokenTypeKind.RParen) {
    tokens.next();
    return nilNode();
  }
  if (peek.kind === TokenTypeKind.Comment) {
    tokens.next();
    return parseList(tokens);
  }

  const car = parse(tokens);
  const peek2 = tokens.peekNextToken().token;
  let cdr: NodeData;
  if (peek2 && peek2.kind === TokenTypeKind.Dot) {
    tokens.next();
    cdr = parse(tokens);
    const close = tokens.next();
    if (!close || close.kind !== TokenTypeKind.RParen) {
      throw new ParseError('Expected ) after dot');
    }
  } else {
    cdr = parseList(tokens);
  }

  return { type: 'pair', car: ref(car), cdr: ref(cdr) };
}
