export enum SpecialForm {
  Quote = 'quote',
  Cond = 'cond',
  If = 'if',
  Begin = 'begin',
  Lambda = 'lambda',
  Let = 'let',
  Define = 'define',
  DefineSyntaxRule = 'define-syntax-rule',
  Set = 'set!',
  SetCar = 'set-car!',
  SetCdr = 'set-cdr!',
  And = 'and',
  Or = 'or',
  Display = 'display',
  NewLine = 'newline',
  Graphviz = 'graphviz',
  BreakPoint = 'breakpoint',
  Import = 'import',
}

export function specialFormFromString(s: string): SpecialForm | null {
  const map: Record<string, SpecialForm> = {
    quote: SpecialForm.Quote,
    cond: SpecialForm.Cond,
    if: SpecialForm.If,
    begin: SpecialForm.Begin,
    lambda: SpecialForm.Lambda,
    let: SpecialForm.Let,
    define: SpecialForm.Define,
    'define-syntax-rule': SpecialForm.DefineSyntaxRule,
    'set!': SpecialForm.Set,
    'set-car!': SpecialForm.SetCar,
    'set-cdr!': SpecialForm.SetCdr,
    and: SpecialForm.And,
    or: SpecialForm.Or,
    display: SpecialForm.Display,
    newline: SpecialForm.NewLine,
    graphviz: SpecialForm.Graphviz,
    breakpoint: SpecialForm.BreakPoint,
    import: SpecialForm.Import,
  };
  return map[s] ?? null;
}

export const SPECIAL_FORM_NAMES: Record<SpecialForm, string> = {
  [SpecialForm.Quote]: 'quote',
  [SpecialForm.Cond]: 'cond',
  [SpecialForm.If]: 'if',
  [SpecialForm.Begin]: 'begin',
  [SpecialForm.Lambda]: 'lambda',
  [SpecialForm.Let]: 'let',
  [SpecialForm.Define]: 'define',
  [SpecialForm.DefineSyntaxRule]: 'define-syntax-rule',
  [SpecialForm.Set]: 'set!',
  [SpecialForm.SetCar]: 'set-car!',
  [SpecialForm.SetCdr]: 'set-cdr!',
  [SpecialForm.And]: 'and',
  [SpecialForm.Or]: 'or',
  [SpecialForm.Display]: 'display',
  [SpecialForm.NewLine]: 'newline',
  [SpecialForm.Graphviz]: 'graphviz',
  [SpecialForm.BreakPoint]: 'breakpoint',
  [SpecialForm.Import]: 'import',
};

export enum BuiltinSymbol {
  Nil = 'nil',
  Atom = 'atom?',
  Number = 'number?',
  Eq = 'eq?',
  Car = 'car',
  Cdr = 'cdr',
  Cons = 'cons',
  T = 't',
  List = 'list',
  Add = '+',
  Sub = '-',
  Mul = '*',
  Div = '/',
  Gt = '>',
  Lt = '<',
  Ge = '>=',
  Le = '<=',
  EqNum = '=',
}

export type SymbolType = BuiltinSymbol | { kind: 'user'; name: string };

export function makeSymbol(s: string): SymbolType {
  switch (s) {
    case 'nil': return BuiltinSymbol.Nil;
    case 'atom?': return BuiltinSymbol.Atom;
    case 'number?': return BuiltinSymbol.Number;
    case 'eq?': return BuiltinSymbol.Eq;
    case 'car': return BuiltinSymbol.Car;
    case 'cdr': return BuiltinSymbol.Cdr;
    case 'cons': return BuiltinSymbol.Cons;
    case 't': return BuiltinSymbol.T;
    case 'list': return BuiltinSymbol.List;
    case '+': return BuiltinSymbol.Add;
    case '-': return BuiltinSymbol.Sub;
    case '*': return BuiltinSymbol.Mul;
    case '/': return BuiltinSymbol.Div;
    case '>': return BuiltinSymbol.Gt;
    case '<': return BuiltinSymbol.Lt;
    case '>=': return BuiltinSymbol.Ge;
    case '<=': return BuiltinSymbol.Le;
    case '=': return BuiltinSymbol.EqNum;
    default: return { kind: 'user', name: s };
  }
}

export function symbolToString(sym: SymbolType): string {
  if (typeof sym === 'string') return sym;
  return sym.name;
}

export function isBuiltin(sym: SymbolType): sym is BuiltinSymbol {
  return typeof sym === 'string';
}
