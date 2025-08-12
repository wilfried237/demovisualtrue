'use client'
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight, Plus, Eye, EyeOff, Calculator, TrendingUp, X } from 'lucide-react';

// Type definitions
interface ASTNode {
  type: string;
  left?: ASTNode | string | number;
  right?: ASTNode | string | number;
  operand?: ASTNode | string | number;
}

interface FormulaMap {
  [key: string]: string;
}

interface ParsedExpression {
  variables: string[];
  operators: string[];
  tokens: string[];
  ast?: ASTNode;
}

interface TreeNode {
  name: string;
  type: 'formula' | 'leaf' | 'circular';
  expression?: string;
  operators?: string[];
  children: TreeNode[];
  depth: number;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'variable' | 'operation' | 'result';
  x: number;
  y: number;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: 'input' | 'output' | 'direct';
  operation?: string;
}

interface ExpressionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface DerivativesModalProps {
  formulaName: string;
  onClose: () => void;
}

interface TreeNodeProps {
  node: TreeNode;
  level?: number;
}

interface FormulaManagementProps {
  initialFormula?: string;
  formulaName?: string;
  onFormulaChange?: (formulas: FormulaMap) => void;
}

// Formula Parser Class
class FormulaParser {
  private operators: { [key: string]: string } = {
    '+': 'Add',
    '-': 'Subtract',
    '*': 'Multiply',
    '/': 'Divide',
    '**': 'Power',
    '^': 'Power'
  };

  private tokenize(formula: string): string[] {
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

      if (char === '*' && nextChar === '*') {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        tokens.push('**');
        i += 2;
        continue;
      }

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

    if (token === '(') {
      pos.value++;
      const expr = this.parseExpression(tokens, pos);
      if (pos.value >= tokens.length || tokens[pos.value] !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      pos.value++;
      return expr;
    }

    if (!isNaN(Number(token))) {
      pos.value++;
      return Number(token);
    }

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

export const FormulaManagement: React.FC<FormulaManagementProps> = ({ 
  initialFormula = "(Capex + Opex) * (1 + Inflation_Rate)",
  formulaName = "Total_Cost",
  onFormulaChange
}) => {
  const [formulas, setFormulas] = useState<FormulaMap>({});
  const [newFormulaName, setNewFormulaName] = useState<string>('');
  const [newFormulaExpression, setNewFormulaExpression] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([formulaName]));
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());
  const [rootFormula, setRootFormula] = useState<string>(formulaName);
  const [showDerivatives, setShowDerivatives] = useState<string | null>(null);
  const [selectedNodeValue, setSelectedNodeValue] = useState<{ node: string; value: string } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const parser = useMemo(() => new FormulaParser(), []);

  // Initialize formulas based on the initial formula prop
  useEffect(() => {
    try {
      const { dependencies } = parser.parseFormulaToAST(initialFormula);
      const initialFormulas: FormulaMap = {
        [formulaName]: initialFormula
      };

      // Add placeholder formulas for dependencies
      dependencies.forEach(dep => {
        if (!initialFormulas[dep]) {
          initialFormulas[dep] = `${dep}_placeholder`;
        }
      });

      setFormulas(initialFormulas);
      setRootFormula(formulaName);
      setParseError(null);
    } catch (error) {
      setParseError(`Error parsing initial formula: ${error}`);
      setFormulas({ [formulaName]: initialFormula });
    }
  }, [initialFormula, formulaName, parser]);

  // Notify parent component when formulas change
  useEffect(() => {
    if (onFormulaChange) {
      onFormulaChange(formulas);
    }
  }, [formulas, onFormulaChange]);

  // Parse expression using the FormulaParser
  const parseExpression = useCallback((expr: string): ParsedExpression => {
    try {
      const { ast, dependencies } = parser.parseFormulaToAST(expr);
      const variables = Array.from(dependencies);
      const operators: string[] = [];
      const tokens: string[] = [];

      const extractOperators = (node: ASTNode | string | number): void => {
        if (typeof node === 'object' && node !== null) {
          if (node.type && !operators.includes(node.type)) {
            operators.push(node.type);
          }
          if (node.left) extractOperators(node.left);
          if (node.right) extractOperators(node.right);
          if (node.operand) extractOperators(node.operand);
        }
      };

      extractOperators(ast);

      return { variables, operators, tokens, ast: ast as ASTNode };
    } catch (error) {
      console.error('Error parsing expression:', error);
      return { variables: [], operators: [], tokens: [] };
    }
  }, [parser]);

  // Simple symbolic differentiation
  const differentiate = (expr: string, variable: string): string => {
    expr = expr.replace(/\s/g, '');
    
    if (!expr.includes(variable)) {
      return '0';
    }
    
    if (expr === variable) {
      return '1';
    }

    try {
      if (expr.includes('+') || expr.includes('-')) {
        const parts = expr.split(/([+-])/).filter((p: string) => p.trim());
        let result = '';
        let sign = '';
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part === '+' || part === '-') {
            sign = part;
          } else {
            const derivative = differentiate(part, variable);
            if (derivative !== '0') {
              if (result && derivative !== '0') {
                result += ` ${sign || '+'} `;
              }
              result += derivative === '1' && part === variable ? '1' : derivative;
            }
          }
        }
        return result || '0';
      }
      
      if (expr.includes('*')) {
        const parts = expr.split('*');
        if (parts.length === 2) {
          const [a, b] = parts;
          const da: string = differentiate(a, variable);
          const db: string = differentiate(b, variable);
          
          if (da === '0' && db === '0') return '0';
          if (da === '0') return db === '1' ? a : `${a} * ${db}`;
          if (db === '0') return da === '1' ? b : `${da} * ${b}`;
          
          return `${a} * ${db} + ${b} * ${da}`;
        }
      }
      
      return expr.includes(variable) ? '1' : '0';
    } catch (error) {
      console.error('Error in differentiation:', error);
      return '0';
    }
  };

  // Build dependency tree
  const buildTree = (formulaName: string, visited: Set<string> = new Set(), depth: number = 0): TreeNode => {
    if (visited.has(formulaName)) {
      return {
        name: formulaName,
        type: 'circular',
        children: [],
        depth
      };
    }
    
    visited.add(formulaName);
    const expression = formulas[formulaName];
    
    if (!expression || expression.endsWith('_placeholder')) {
      return {
        name: formulaName,
        type: 'leaf',
        children: [],
        depth
      };
    }
    
    const parsed = parseExpression(expression);
    const children: TreeNode[] = [];
    
    parsed.variables.forEach(variable => {
      if (formulas[variable]) {
        children.push(buildTree(variable, new Set(visited), depth + 1));
      } else {
        children.push({
          name: variable,
          type: 'leaf',
          children: [],
          depth: depth + 1
        });
      }
    });
    
    return {
      name: formulaName,
      type: 'formula',
      expression,
      operators: parsed.operators,
      children,
      depth
    };
  };

  // Toggle node expansion
  const toggleExpanded = (nodeName: string): void => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeName)) {
        newSet.delete(nodeName);
      } else {
        newSet.add(nodeName);
      }
      return newSet;
    });
  };

  // Add new formula
  const addFormula = (): void => {
    if (newFormulaName && newFormulaExpression && !formulas[newFormulaName]) {
      try {
        // Validate the formula by parsing it
        parser.parseFormulaToAST(newFormulaExpression);
        
        setFormulas(prev => ({
          ...prev,
          [newFormulaName]: newFormulaExpression
        }));
        setNewFormulaName('');
        setNewFormulaExpression('');
        setParseError(null);
      } catch (error) {
        setParseError(`Invalid formula: ${error}`);
      }
    }
  };

  // Build expression graph for visualization
  const buildExpressionGraph = (formulaName: string): ExpressionGraph => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let nodeId = 0;
    
    const expression = formulas[formulaName];
    if (!expression) return { nodes, edges };

    try {
      const { ast } = parser.parseFormulaToAST(expression);
      
      const buildASTGraph = (node: ASTNode | string | number, level: number = 1, parentId?: string): string => {
        const currentId = `node_${nodeId++}`;
        
        if (typeof node === 'string') {
          nodes.push({
            id: currentId,
            label: node,
            type: isNaN(Number(node)) ? 'variable' : 'result',
            x: level * 100,
            y: nodes.length * 60
          });
        } else if (typeof node === 'number') {
          nodes.push({
            id: currentId,
            label: node.toString(),
            type: 'result',
            x: level * 100,
            y: nodes.length * 60
          });
        } else {
          nodes.push({
            id: currentId,
            label: node.type,
            type: 'operation',
            x: level * 100,
            y: nodes.length * 60
          });
          
          if (node.left) {
            const leftId = buildASTGraph(node.left, level + 1, currentId);
            edges.push({
              id: `edge_${edges.length}`,
              from: leftId,
              to: currentId,
              type: 'input',
              operation: node.type
            });
          }
          
          if (node.right) {
            const rightId = buildASTGraph(node.right, level + 1, currentId);
            edges.push({
              id: `edge_${edges.length}`,
              from: rightId,
              to: currentId,
              type: 'input',
              operation: node.type
            });
          }
          
          if (node.operand) {
            const operandId = buildASTGraph(node.operand, level + 1, currentId);
            edges.push({
              id: `edge_${edges.length}`,
              from: operandId,
              to: currentId,
              type: 'input',
              operation: node.type
            });
          }
        }
        
        return currentId;
      };
      
      buildASTGraph(ast);
    } catch (error) {
      console.error('Error building expression graph:', error);
    }
    
    return { nodes, edges };
  };

  // Memoized tree
  const tree = useMemo(() => {
    return rootFormula ? buildTree(rootFormula) : null;
  }, [rootFormula, formulas]);

  // Derivatives Modal Component
  const DerivativesModal: React.FC<DerivativesModalProps> = ({ formulaName, onClose }) => {
    const [selectedVariable, setSelectedVariable] = useState<string>('');
    const [derivatives, setDerivatives] = useState<{ [key: string]: string }>({});
    const [graph, setGraph] = useState<ExpressionGraph>({ nodes: [], edges: [] });
    
    const handleNodeClick = (node: GraphNode): void => {
      setSelectedNodeValue({ node: node.id, value: node.label });
    };
    
    const calculateDerivatives = useCallback(() => {
      const expression = formulas[formulaName];
      if (!expression) return;
      
      const parsed = parseExpression(expression);
      const newDerivatives: { [key: string]: string } = {};
      
      parsed.variables.forEach(variable => {
        newDerivatives[variable] = differentiate(expression, variable);
      });
      
      setDerivatives(newDerivatives);
      setGraph(buildExpressionGraph(formulaName));
    }, [formulaName]);
    
    useEffect(() => {
      calculateDerivatives();
    }, [calculateDerivatives]);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Expression Analysis: {formulaName}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-gray-300 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Partial Derivatives
              </h3>
              
              <div className="space-y-3">
                {Object.entries(derivatives).map(([variable, derivative]) => (
                  <div key={variable} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">∂{formulaName}/∂{variable}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedVariable(variable)}
                        className={`border-gray-300 hover:bg-gray-50 ${
                          selectedVariable === variable ? 'bg-blue-50 border-blue-300' : ''
                        }`}
                      >
                        Analyze
                      </Button>
                    </div>
                    <div className="text-sm font-mono text-gray-700 bg-white p-2 rounded border">
                      {derivative}
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedVariable && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Analysis for ∂{formulaName}/∂{selectedVariable}
                  </h4>
                  <div className="text-sm text-blue-800">
                    <p>• Impact: {derivatives[selectedVariable] === '0' ? 'No direct impact' : 'Direct impact'}</p>
                    <p>• Sensitivity: {derivatives[selectedVariable] === '0' ? 'Insensitive' : 'Sensitive'}</p>
                    <p>• Type: {derivatives[selectedVariable].includes('*') ? 'Multiplicative' : 'Additive'}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                Expression Graph
              </h3>
              
              <div className="bg-gray-50 rounded-lg p-4 min-h-[400px] relative overflow-auto">
                <svg width="100%" height="400" className="border border-gray-200 rounded">
                  {graph.edges.map((edge) => {
                    const fromNode = graph.nodes.find(n => n.id === edge.from);
                    const toNode = graph.nodes.find(n => n.id === edge.to);
                    
                    if (!fromNode || !toNode) return null;
                    
                    return (
                      <line
                        key={edge.id}
                        x1={fromNode.x + 50}
                        y1={fromNode.y + 30}
                        x2={toNode.x + 50}
                        y2={toNode.y + 30}
                        stroke="#6B7280"
                        strokeWidth="2"
                        markerEnd="url(#arrowhead)"
                      />
                    );
                  })}
                  
                  {graph.nodes.map((node) => (
                    <g key={node.id}>
                      <circle
                        cx={node.x + 50}
                        cy={node.y + 30}
                        r={node.type === 'operation' ? 25 : 20}
                        fill={node.type === 'operation' ? '#3B82F6' : '#10B981'}
                        stroke={selectedNodeValue?.node === node.id ? '#EF4444' : '#6B7280'}
                        strokeWidth={selectedNodeValue?.node === node.id ? 3 : 1}
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => handleNodeClick(node)}
                      />
                      <text
                        x={node.x + 50}
                        y={node.y + 35}
                        textAnchor="middle"
                        className="text-xs font-medium fill-white pointer-events-none"
                      >
                        {node.label.length > 8 ? node.label.substring(0, 8) + '...' : node.label}
                      </text>
                    </g>
                  ))}
                  
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
                    </marker>
                  </defs>
                </svg>
                
                {selectedNodeValue && (
                  <div className="absolute top-2 right-2 bg-white p-2 rounded border shadow-sm">
                    <div className="text-xs text-gray-600">Selected:</div>
                    <div className="text-sm font-medium">{selectedNodeValue.value}</div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Operation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Variable</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Selected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // TreeNode Component
  const TreeNode: React.FC<TreeNodeProps> = ({ node, level = 0 }) => {
    const isExpanded = expandedNodes.has(node.name);
    const isHighlighted = highlightedPath.has(node.name);
    
    const getNodeColor = (): string => {
      if (node.type === 'circular') return 'bg-red-100 border-red-200';
      if (isHighlighted) return 'bg-blue-100 border-blue-300';
      if (node.type === 'formula') return 'bg-green-100 border-green-200';
      return 'bg-gray-100 border-gray-200';
    };
    
    const getDepthColor = (depth: number): string => {
      const colors = ['border-l-blue-500', 'border-l-green-500', 'border-l-purple-500', 'border-l-orange-500', 'border-l-red-500'];
      return colors[depth % colors.length];
    };
    
    return (
      <div className={`ml-${level * 4}`}>
        <div
          className={`flex items-center p-2 rounded-lg border ${getNodeColor()} ${getDepthColor(node.depth)} border-l-4 cursor-pointer hover:shadow-sm transition-shadow`}
          onClick={() => toggleExpanded(node.name)}
        >
          {node.children.length > 0 && (
            <div className="mr-2">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )}
            </div>
          )}
          
          <div className="flex-1">
            <div className="font-medium text-gray-900">{node.name}</div>
            {node.expression && (
              <div className="text-xs text-gray-600 font-mono mt-1">{node.expression}</div>
            )}
            {node.type === 'circular' && (
              <div className="text-xs text-red-600 mt-1">⚠️ Circular Reference</div>
            )}
          </div>
          
          {node.type === 'formula' && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDerivatives(node.name);
              }}
              className="ml-2 border-gray-300 hover:bg-gray-50"
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {isExpanded && node.children.length > 0 && (
          <div className="mt-2 ml-4 space-y-2">
            {node.children.map((child, index) => (
              <TreeNode key={`${child.name}-${index}`} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <Card className="border-gray-200 shadow-lg">
        <CardHeader className="border-b border-gray-100 bg-gray-50/50">
          <CardTitle className="flex items-center space-x-3 text-2xl font-semibold text-black">
            <Calculator className="h-7 w-7 text-black" />
            <span>Dynamic Formula Management</span>
          </CardTitle>
          <div className="text-sm text-gray-600 mt-2">
            Root: <span className="font-mono font-medium">{formulaName}</span> = 
            <span className="font-mono font-medium ml-2">{initialFormula}</span>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {parseError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <X className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-700 font-medium">Parse Error:</span>
              </div>
              <p className="text-red-600 text-sm mt-1">{parseError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            
            {/* Formula Management Panel */}
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-black border-b border-gray-200 pb-3">Formula Management</h3>
              
              <div className="space-y-3">
                <Label htmlFor="root-select" className="text-sm font-medium text-gray-700">Root Formula</Label>
                <select 
                  id="root-select"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black transition-colors bg-white text-black"
                  value={rootFormula}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRootFormula(e.target.value)}
                >
                  {Object.keys(formulas).map((name: string) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Label htmlFor="formula-name" className="text-sm font-medium text-gray-700">Add New Formula</Label>
                <Input
                  id="formula-name"
                  placeholder="Formula name"
                  value={newFormulaName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFormulaName(e.target.value)}
                  className="border-gray-300 focus:ring-black focus:border-black"
                />
                <Input
                  placeholder="Expression (e.g., A + B * C)"
                  value={newFormulaExpression}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFormulaExpression(e.target.value)}
                  className="border-gray-300 focus:ring-black focus:border-black"
                />
                <Button onClick={addFormula} className="w-full bg-black hover:bg-gray-800 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Formula
                </Button>
              </div>

              <div className="space-y-4">
                <h4 className="text-lg font-medium text-black border-b border-gray-200 pb-2">Current Formulas</h4>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {Object.entries(formulas).map(([name, expr]: [string, string]) => (
                    <div key={name} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <div className="font-semibold text-black">{name}</div>
                            {name === formulaName && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">ROOT</span>
                            )}
                            {expr.endsWith('_placeholder') && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">PLACEHOLDER</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1 font-mono">{expr}</div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDerivatives(name)}
                            className="border-gray-300 hover:bg-gray-50"
                            disabled={expr.endsWith('_placeholder')}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                          {name !== formulaName && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFormulas(prev => {
                                  const newFormulas = { ...prev };
                                  delete newFormulas[name];
                                  return newFormulas;
                                });
                              }}
                              className="border-red-300 hover:bg-red-50 text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Parser Information */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Parser Information</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Supports: +, -, *, /, ^, ** (power)</p>
                  <p>• Parentheses for grouping</p>
                  <p>• Variables: alphanumeric + underscore</p>
                  <p>• Numbers: integers and decimals</p>
                </div>
              </div>
            </div>

            {/* Tree Visualization */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Dependency Tree</h3>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedNodes(new Set())}
                  >
                    <EyeOff className="h-4 w-4 mr-1" />
                    Collapse All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allNodes = new Set<string>();
                      const collectNodes = (node: TreeNode): void => {
                        allNodes.add(node.name);
                        node.children?.forEach(collectNodes);
                      };
                      if (tree) collectNodes(tree);
                      setExpandedNodes(allNodes);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Expand All
                  </Button>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-4 max-h-96 overflow-auto">
                {rootFormula && tree ? (
                  <TreeNode node={tree} />
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    Select a root formula to visualize the dependency tree
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Legend</h4>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                    <span>Formula Node</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded"></div>
                    <span>Leaf Variable</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                    <span>Highlighted Path</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
                    <span>Circular Reference</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <span>Analyze Expression</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600">Total Formulas</div>
                  <div className="text-2xl font-bold text-gray-900">{Object.keys(formulas).length}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600">Tree Depth</div>
                  <div className="text-2xl font-bold text-gray-900">{tree?.depth || 0}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Analysis Modal */}
      {showDerivatives && (
        <DerivativesModal
          formulaName={showDerivatives}
          onClose={() => setShowDerivatives(null)}
        />
      )}
    </div>
  );
};

// Example usage component
export const ExampleUsage: React.FC = () => {
  const [currentFormula, setCurrentFormula] = useState("(Capex + Opex) * (1 + Inflation_Rate)");
  const [formulaName, setFormulaName] = useState("Total_Cost");

  const handleFormulaChange = (formulas: FormulaMap) => {
    console.log('Formulas updated:', formulas);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-xl font-bold text-blue-900 mb-4">Dynamic Formula Demo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="demo-name" className="text-sm font-medium text-blue-800">Formula Name</Label>
            <Input
              id="demo-name"
              value={formulaName}
              onChange={(e) => setFormulaName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="demo-formula" className="text-sm font-medium text-blue-800">Formula Expression</Label>
            <Input
              id="demo-formula"
              value={currentFormula}
              onChange={(e) => setCurrentFormula(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <p className="text-sm text-blue-700">
          Try changing the formula above to see the dynamic parsing and visualization!
        </p>
      </div>

      <FormulaManagement
        initialFormula={currentFormula}
        formulaName={formulaName}
        onFormulaChange={handleFormulaChange}
      />
    </div>
  );
};