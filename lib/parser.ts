import { ASTNode } from "@/app/type/types";

  // TypeScript Formula Parser (equivalent to Python version)
export class FormulaParser {
    private operators: { [key: string]: string } = {
      '+': 'Add',
      '-': 'Subtract',
      '*': 'Multiply',
      '/': 'Divide',
      '**': 'Power',
      '^': 'Power'
    };

    private tokenize(formula: string): string[] {
      // Simple tokenizer - splits by operators and parentheses while preserving them
      const tokens: string[] = [];
      let current = '';
      let i = 0;

      while (i < formula.length) {
        const char = formula[i];
        const nextChar = formula[i + 1];

        if (char === ' ') {
          if (current.trim()) {
            tokens.push(current.trim());
            current = '';
          }
          i++;
          continue;
        }

        // Handle two-character operators
        if (char === '*' && nextChar === '*') {
          if (current.trim()) {
            tokens.push(current.trim());
            current = '';
          }
          tokens.push('**');
          i += 2;
          continue;
        }

        // Handle single-character operators and parentheses
        if (['+', '-', '*', '/', '^', '(', ')'].includes(char)) {
          if (current.trim()) {
            tokens.push(current.trim());
            current = '';
          }
          tokens.push(char);
          i++;
          continue;
        }

        current += char;
        i++;
      }

      if (current.trim()) {
        tokens.push(current.trim());
      }

      return tokens.filter(token => token.length > 0);
    }

    private parseExpression(tokens: string[], pos: { value: number }): ASTNode | string | number {
      return this.parseAddSub(tokens, pos);
    }

    private parseAddSub(tokens: string[], pos: { value: number }): ASTNode | string | number {
      let left = this.parseMulDiv(tokens, pos);

      while (pos.value < tokens.length && (tokens[pos.value] === '+' || tokens[pos.value] === '-')) {
        const op = tokens[pos.value];
        pos.value++;
        const right = this.parseMulDiv(tokens, pos);
        left = {
          type: this.operators[op],
          left,
          right
        };
      }

      return left;
    }

    private parseMulDiv(tokens: string[], pos: { value: number }): ASTNode | string | number {
      let left = this.parsePower(tokens, pos);

      while (pos.value < tokens.length && (tokens[pos.value] === '*' || tokens[pos.value] === '/')) {
        const op = tokens[pos.value];
        pos.value++;
        const right = this.parsePower(tokens, pos);
        left = {
          type: this.operators[op],
          left,
          right
        };
      }

      return left;
    }

    private parsePower(tokens: string[], pos: { value: number }): ASTNode | string | number {
      let left = this.parseUnary(tokens, pos);

      while (pos.value < tokens.length && (tokens[pos.value] === '**' || tokens[pos.value] === '^')) {
        const op = tokens[pos.value];
        pos.value++;
        const right = this.parseUnary(tokens, pos);
        left = {
          type: this.operators[op],
          left,
          right
        };
      }

      return left;
    }

    private parseUnary(tokens: string[], pos: { value: number }): ASTNode | string | number {
      if (pos.value < tokens.length && (tokens[pos.value] === '+' || tokens[pos.value] === '-')) {
        const op = tokens[pos.value];
        pos.value++;
        const operand = this.parseUnary(tokens, pos);
        return {
          type: `Unary_${op === '+' ? 'UAdd' : 'USub'}`,
          operand
        };
      }

      return this.parseFactor(tokens, pos);
    }

    private parseFactor(tokens: string[], pos: { value: number }): ASTNode | string | number {
      if (pos.value >= tokens.length) {
        throw new Error('Unexpected end of expression');
      }

      const token = tokens[pos.value];

      // Handle parentheses
      if (token === '(') {
        pos.value++; // consume '('
        const expr = this.parseExpression(tokens, pos);
        if (pos.value >= tokens.length || tokens[pos.value] !== ')') {
          throw new Error('Missing closing parenthesis');
        }
        pos.value++; // consume ')'
        return expr;
      }

      // Handle numbers
      if (!isNaN(Number(token))) {
        pos.value++;
        return Number(token);
      }

      // Handle variables/identifiers
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
        pos.value++;
        return token;
      }

      throw new Error(`Unexpected token: ${token}`);
    }

    private extractVariables(node: ASTNode | string | number, varsSet: Set<string> = new Set()): Set<string> {
      if (typeof node === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(node)) {
        varsSet.add(node);
      } else if (typeof node === 'object' && node !== null) {
        if ('left' in node && node.left) {
          this.extractVariables(node.left, varsSet);
        }
        if ('right' in node && node.right) {
          this.extractVariables(node.right, varsSet);
        }
        if ('operand' in node && node.operand) {
          this.extractVariables(node.operand, varsSet);
        }
      }
      return varsSet;
    }

    public parseFormulaToAST(formula: string): { ast: ASTNode | string | number; dependencies: Set<string> } {
      try {
        const tokens = this.tokenize(formula);
        const pos = { value: 0 };
        const ast = this.parseExpression(tokens, pos);
        
        if (pos.value < tokens.length) {
          throw new Error(`Unexpected tokens after expression: ${tokens.slice(pos.value).join(' ')}`);
        }

        const dependencies = this.extractVariables(ast);
        return { ast, dependencies };
      } catch (error) {
        throw new Error(`Error parsing formula: ${error}`);
      }
    }
  }