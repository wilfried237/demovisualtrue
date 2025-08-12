'use client'
import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Trash2, TrendingUp, X } from 'lucide-react';
import { SolutionConfiguration } from './type/types';
import { FormulaMap, ParsedExpression, ASTNode, TreeNode, GraphNode, GraphEdge, ExpressionGraph, DerivativesModalProps, TreeNodeProps } from './type/types';
import { FormulaParser } from '@/lib/parser';
import { SolutionConfigurationPages } from '@/components/ui/solutionConfig';
import { useRouter } from 'next/navigation';
import { ExampleUsage } from '@/components/formular';

const RecursiveFormulaTree: React.FC = () => {
  const [formulas, setFormulas] = useState<FormulaMap>({
    "Total_Cost": "(Capex + Opex) * (1 + Inflation_Rate)",
    "Capex": "Equipment_Cost + Installation_Cost",
    "Opex": "Energy_Cost + Maintenance_Cost", 
    "Inflation_Rate": "Base_Inflation + Risk_Premium",
    "Risk_Premium": "Market_Volatility * Adjustment_Factor"
  });

  const [newFormulaName, setNewFormulaName] = useState<string>('');
  const [newFormulaExpression, setNewFormulaExpression] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['Total_Cost']));
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());
  const [rootFormula, setRootFormula] = useState<string>('Total_Cost');
  const [showDerivatives, setShowDerivatives] = useState<string | null>(null);
  const [selectedNodeValue, setSelectedNodeValue] = useState<{ node: string; value: string } | null>(null);
  const [solutions, setSolutions] = useState<SolutionConfiguration[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useRouter();
  useEffect(() => {
    const fetchFormulas = async (): Promise<void> => {
      setLoading(true);
      const res = await fetch('/api/formulas');
      const data = await res.json();
      const solutionConfiguration: SolutionConfiguration[] = data.formulas;
      setSolutions(solutionConfiguration);
      setLoading(false);
    };

    fetchFormulas();
  }, [navigate]);



  // Simple symbolic differentiation
  const differentiate = (expr: string, variable: string): string => {
    // Remove spaces and handle basic cases
    expr = expr.replace(/\s/g, '');
    
    // If expression doesn't contain the variable, derivative is 0
    if (!expr.includes(variable)) {
      return '0';
    }
    
    // If expression is just the variable, derivative is 1
    if (expr === variable) {
      return '1';
    }
    
    // Handle basic operations
    try {
      // Simple addition/subtraction: d(a + b)/dx = da/dx + db/dx
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
      
      // Simple multiplication: d(a * b)/dx = a * db/dx + b * da/dx (simplified)
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
      
      // Handle parentheses - simplified approach
      if (expr.includes('(') && expr.includes(')')) {
        // For expressions like (a + b) * c, extract and differentiate
        const match = expr.match(/\(([^)]+)\)/);
        if (match) {
          const innerExpr = match[1];
          const innerDerivative: string = differentiate(innerExpr, variable);
          if (innerDerivative === '0') return '0';
          
          // If the parentheses are multiplied by something
          const remaining = expr.replace(match[0], 'INNER');
          if (remaining.includes('*')) {
            const parts = remaining.split('*');
            const coefficient = parts.find((p: string) => p !== 'INNER');
            return coefficient ? `${coefficient} * (${innerDerivative})` : innerDerivative;
          }
          return innerDerivative;
        }
      }
      
      return `d(${expr})/d(${variable})`;
    } catch (e) {
      return `d(${expr})/d(${variable})`;
    }
  };

  // Parse expression to extract variables and operations using AST
  const parseExpression = (expr: string): ParsedExpression => {
    try {
      const parser = new FormulaParser();
      const { ast, dependencies } = parser.parseFormulaToAST(expr);
      
             // Extract operators from AST
       const operators = new Set<string>();
       const extractOperators = (node: ASTNode | string | number): void => {
         if (typeof node === 'object' && node !== null && 'type' in node) {
           const operatorSymbols: { [key: string]: string } = {
             'Add': '+',
             'Subtract': '-',
             'Multiply': '*',
             'Divide': '/',
             'Power': '**'
           };
           
           if (operatorSymbols[node.type]) {
             operators.add(operatorSymbols[node.type]);
           }
           
           if (node.left) extractOperators(node.left);
           if (node.right) extractOperators(node.right);
           if (node.operand) extractOperators(node.operand);
         }
       };
      
      extractOperators(ast);
      
      // Create tokens from original expression for backwards compatibility
      const tokens = expr.replace(/[()]/g, ' $& ').split(/\s+/).filter((token: string) => token.trim());
      
      return { 
        variables: Array.from(dependencies), 
        operators: Array.from(operators), 
        tokens,
        ast: ast as ASTNode
      };
    } catch (error) {
      // Fallback to original parsing if AST parsing fails
      console.warn('AST parsing failed, falling back to simple parsing:', error);
      const tokens = expr.replace(/[()]/g, ' $& ').split(/\s+/).filter((token: string) => token.trim());
      const variables = tokens.filter((token: string) => 
      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token) && 
      !['and', 'or', 'not'].includes(token.toLowerCase())
    );
      const operators = tokens.filter((token: string) => /^[+\-*/()%^]$/.test(token));
    
    return { variables: [...new Set(variables)], operators, tokens };
    }
  };

  // Build recursive tree structure
  const buildTree = (formulaName: string, visited: Set<string> = new Set(), depth: number = 0): TreeNode => {
    if (visited.has(formulaName) || depth > 10) {
      return { name: formulaName, type: 'circular', children: [], depth };
    }

    const expression = formulas[formulaName];
    if (!expression) {
      return { name: formulaName, type: 'leaf', children: [], depth };
    }

    const { variables, operators } = parseExpression(expression);
    const newVisited = new Set([...visited, formulaName]);
    
    const children: TreeNode[] = variables.map((variable: string): TreeNode => {
      if (formulas[variable]) {
        return buildTree(variable, newVisited, depth + 1);
      }
      return { name: variable, type: 'leaf', children: [], depth: depth + 1 };
    });

    return {
      name: formulaName,
      type: 'formula',
      expression,
      operators,
      children,
      depth
    };
  };

  const tree = useMemo(() => buildTree(rootFormula), [formulas, rootFormula]);

  const toggleExpanded = (nodeName: string): void => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeName)) {
      newExpanded.delete(nodeName);
    } else {
      newExpanded.add(nodeName);
    }
    setExpandedNodes(newExpanded);
  };

  const addFormula = (): void => {
    if (newFormulaName && newFormulaExpression) {
      setFormulas(prev => ({
        ...prev,
        [newFormulaName]: newFormulaExpression
      }));
      setNewFormulaName('');
      setNewFormulaExpression('');
    }
  };

  const removeFormula = (name: string): void => {
    const newFormulas = { ...formulas };
    delete newFormulas[name];
    setFormulas(newFormulas);
    if (rootFormula === name) {
      const remaining = Object.keys(newFormulas);
      setRootFormula(remaining[0] || '');
    }
  };

  const highlightPath = (nodeName: string): void => {
    const path = new Set<string>();
    const findPath = (node: TreeNode, target: string, currentPath: string[] = []): boolean => {
      const newPath = [...currentPath, node.name];
      if (node.name === target) {
        newPath.forEach((name: string) => path.add(name));
        return true;
      }
      for (const child of node.children) {
        if (findPath(child, target, newPath)) {
          return true;
        }
      }
      return false;
    };
    findPath(tree, nodeName);
    setHighlightedPath(path);
  };

  // Build expression connectivity graph using AST with vertical tree layout
  const buildExpressionGraph = (formulaName: string, expandedNodes: Set<string> = new Set()): ExpressionGraph => {
    const expression = formulas[formulaName];
    if (!expression) return { nodes: [], edges: [] };
    
    const parsed = parseExpression(expression);
    const { variables, ast } = parsed;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // Tree layout configuration
    const LEVEL_HEIGHT = 120;
    const NODE_SPACING = 120; // Adjusted for deeper trees
    const ROOT_Y = 60;
    const SVG_CENTER_X = 400;
    
    // Track nodes at each level for positioning
    const levelNodes: { [level: number]: string[] } = {};
    const nodePositions: { [nodeId: string]: { x: number; y: number; level: number } } = {};
    
    // First, create the result node at the top
    nodes.push({ 
      id: formulaName, 
      label: formulaName, 
      type: 'result', 
      x: SVG_CENTER_X, 
      y: ROOT_Y 
    });
    nodePositions[formulaName] = { x: SVG_CENTER_X, y: ROOT_Y, level: 0 };
    levelNodes[0] = [formulaName];

    // If we have AST, build tree structure
    if (ast && typeof ast === 'object' && 'type' in ast) {
      let opIndex = 0;
      
      const buildASTGraph = (node: ASTNode | string | number, level: number = 1, parentId?: string): string => {
        if (typeof node === 'string') {
          // Variable node
          if (!nodePositions[node]) {
            if (!levelNodes[level]) levelNodes[level] = [];
            levelNodes[level].push(node);
            
            const indexInLevel = levelNodes[level].length - 1;
            const totalAtLevel = levelNodes[level].length;
            const x = SVG_CENTER_X + (indexInLevel - (totalAtLevel - 1) / 2) * NODE_SPACING;
            const y = ROOT_Y + level * LEVEL_HEIGHT;
      
      nodes.push({
              id: node,
              label: node,
        type: 'variable',
        x,
        y
      });
            nodePositions[node] = { x, y, level };
          }
          return node;
        }
        
        if (typeof node === 'number') {
          // Constant node
          const constId = `const_${node}`;
          if (!nodePositions[constId]) {
            if (!levelNodes[level]) levelNodes[level] = [];
            levelNodes[level].push(constId);
            
            const indexInLevel = levelNodes[level].length - 1;
            const totalAtLevel = levelNodes[level].length;
            const x = SVG_CENTER_X + (indexInLevel - (totalAtLevel - 1) / 2) * NODE_SPACING;
            const y = ROOT_Y + level * LEVEL_HEIGHT;
            
            nodes.push({
              id: constId,
              label: node.toString(),
              type: 'variable',
              x,
              y
            });
            nodePositions[constId] = { x, y, level };
          }
          return constId;
        }
        
        if (typeof node === 'object' && node !== null && 'type' in node) {
          const operationSymbols: { [key: string]: string } = {
            'Add': '+',
            'Subtract': '-',
            'Multiply': '×',
            'Divide': '÷',
            'Power': '^'
          };
          
          const opSymbol = operationSymbols[node.type] || node.type;
          const opId = `op_${opIndex++}`;
          
          // Position operation node
          if (!levelNodes[level]) levelNodes[level] = [];
          levelNodes[level].push(opId);
          
          const indexInLevel = levelNodes[level].length - 1;
          const totalAtLevel = levelNodes[level].length;
          const x = SVG_CENTER_X + (indexInLevel - (totalAtLevel - 1) / 2) * NODE_SPACING;
          const y = ROOT_Y + level * LEVEL_HEIGHT;
          
      nodes.push({
            id: opId,
            label: opSymbol,
        type: 'operation',
            x,
            y
          });
          nodePositions[opId] = { x, y, level };
          
          // Handle binary operations
          if (node.left && node.right) {
            const leftId = buildASTGraph(node.left, level + 1, opId);
            const rightId = buildASTGraph(node.right, level + 1, opId);
            
            // Connect operands to operation (bottom to top)
      edges.push({
              id: `${leftId}-${opId}`,
              from: leftId,
              to: opId,
        type: 'input'
      });
      
      edges.push({
              id: `${rightId}-${opId}`,
              from: rightId,
              to: opId,
        type: 'input'
      });
          }
      
          // Handle unary operations
          if (node.operand && !node.left && !node.right) {
            const operandId = buildASTGraph(node.operand, level + 1, opId);
      edges.push({
              id: `${operandId}-${opId}`,
              from: operandId,
              to: opId,
              type: 'input'
            });
          }
          
          return opId;
        }
        
        return 'unknown';
      };
      
      const rootOpId = buildASTGraph(ast, 1);
      
      // Connect the root operation to the result (bottom to top)
      if (rootOpId !== formulaName && nodes.find(n => n.id === rootOpId)) {
        edges.push({
          id: `${rootOpId}-${formulaName}`,
          from: rootOpId,
        to: formulaName,
        type: 'output'
      });
      }
      
      // Reposition nodes to balance the tree better
      Object.keys(levelNodes).forEach(levelStr => {
        const level = parseInt(levelStr);
        const nodesAtLevel = levelNodes[level];
        const totalNodes = nodesAtLevel.length;
        
        nodesAtLevel.forEach((nodeId, index) => {
          if (nodePositions[nodeId]) {
            const x = SVG_CENTER_X + (index - (totalNodes - 1) / 2) * NODE_SPACING;
            nodePositions[nodeId].x = x;
            
            // Update the actual node position
            const nodeToUpdate = nodes.find(n => n.id === nodeId);
            if (nodeToUpdate) {
              nodeToUpdate.x = x;
            }
          }
        });
      });
      
      // Handle recursive expansion of variable nodes that have formulas
      const expandNodeRecursively = (nodeId: string, parentPosition: { x: number; y: number; level: number }, level: number, visited: Set<string> = new Set()): void => {
        // Prevent infinite recursion
        if (visited.has(nodeId) || level > 6) return;
        visited.add(nodeId);
        
        const nodeFormula = formulas[nodeId];
        if (!nodeFormula) return;
        
        // Parse the formula to get its components
        const parsed = parseExpression(nodeFormula);
        const { variables, ast } = parsed;
        
        if (!ast || typeof ast !== 'object' || !('type' in ast)) return;
        
        // Build sub-tree for this node
        let subOpIndex = 0;
        const subLevelNodes: { [level: number]: string[] } = {};
        const subNodePositions: { [nodeId: string]: { x: number; y: number; level: number } } = {};
        
        const buildSubAST = (subNode: ASTNode | string | number, subLevel: number = 1): string => {
          if (typeof subNode === 'string') {
            // Variable node
            const fullId = `${nodeId}_${subNode}`;
            if (!subNodePositions[fullId]) {
              if (!subLevelNodes[subLevel]) subLevelNodes[subLevel] = [];
              subLevelNodes[subLevel].push(fullId);
              
              const indexInLevel = subLevelNodes[subLevel].length - 1;
              const totalAtLevel = subLevelNodes[subLevel].length;
              const x = parentPosition.x + (indexInLevel - (totalAtLevel - 1) / 2) * (NODE_SPACING * 0.7);
              const y = parentPosition.y + (level + subLevel) * LEVEL_HEIGHT;
              
              nodes.push({
                id: fullId,
                label: subNode,
                type: 'variable',
                x,
                y
              });
              subNodePositions[fullId] = { x, y, level: level + subLevel };
              
              // Recursively expand this node if it has a formula
              if (formulas[subNode]) {
                expandNodeRecursively(subNode, { x, y, level: level + subLevel }, level + subLevel + 1, new Set(visited));
              }
            }
            return fullId;
          }
          
          if (typeof subNode === 'number') {
            // Constant node
            const constId = `${nodeId}_const_${subNode}`;
            if (!subNodePositions[constId]) {
              if (!subLevelNodes[subLevel]) subLevelNodes[subLevel] = [];
              subLevelNodes[subLevel].push(constId);
              
              const indexInLevel = subLevelNodes[subLevel].length - 1;
              const totalAtLevel = subLevelNodes[subLevel].length;
              const x = parentPosition.x + (indexInLevel - (totalAtLevel - 1) / 2) * (NODE_SPACING * 0.7);
              const y = parentPosition.y + (level + subLevel) * LEVEL_HEIGHT;
              
              nodes.push({
                id: constId,
                label: subNode.toString(),
                type: 'variable',
                x,
                y
              });
              subNodePositions[constId] = { x, y, level: level + subLevel };
            }
            return constId;
          }
          
          if (typeof subNode === 'object' && subNode !== null && 'type' in subNode) {
            const operationSymbols: { [key: string]: string } = {
              'Add': '+',
              'Subtract': '-',
              'Multiply': '×',
              'Divide': '÷',
              'Power': '^'
            };
            
            const opSymbol = operationSymbols[subNode.type] || subNode.type;
            const opId = `${nodeId}_op_${subOpIndex++}`;
            
            // Position operation node
            if (!subLevelNodes[subLevel]) subLevelNodes[subLevel] = [];
            subLevelNodes[subLevel].push(opId);
            
            const indexInLevel = subLevelNodes[subLevel].length - 1;
            const totalAtLevel = subLevelNodes[subLevel].length;
            const x = parentPosition.x + (indexInLevel - (totalAtLevel - 1) / 2) * (NODE_SPACING * 0.7);
            const y = parentPosition.y + (level + subLevel) * LEVEL_HEIGHT;
            
            nodes.push({
              id: opId,
              label: opSymbol,
              type: 'operation',
              x,
              y
            });
            subNodePositions[opId] = { x, y, level: level + subLevel };
            
            // Handle binary operations
            if (subNode.left && subNode.right) {
              const leftId = buildSubAST(subNode.left, subLevel + 1);
              const rightId = buildSubAST(subNode.right, subLevel + 1);
              
              // Connect operands to operation
              edges.push({
                id: `${leftId}-${opId}`,
                from: leftId,
                to: opId,
                type: 'input'
              });
              
              edges.push({
                id: `${rightId}-${opId}`,
                from: rightId,
                to: opId,
                type: 'input'
              });
            }
            
            // Handle unary operations
            if (subNode.operand && !subNode.left && !subNode.right) {
              const operandId = buildSubAST(subNode.operand, subLevel + 1);
              edges.push({
                id: `${operandId}-${opId}`,
                from: operandId,
                to: opId,
                type: 'input'
              });
            }
            
            return opId;
          }
          
          return 'unknown';
        };
        
        const rootSubOpId = buildSubAST(ast, 1);
        
        // Connect the root operation to the parent node
        if (rootSubOpId && rootSubOpId !== nodeId) {
          edges.push({
            id: `${rootSubOpId}-${nodeId}`,
            from: rootSubOpId,
            to: nodeId,
            type: 'output'
          });
        }
        
        // Reposition nodes in sub-tree to balance better
        Object.keys(subLevelNodes).forEach(levelStr => {
          const subLevel = parseInt(levelStr);
          const nodesAtLevel = subLevelNodes[subLevel];
          const totalNodes = nodesAtLevel.length;
          
          nodesAtLevel.forEach((subNodeId, index) => {
            if (subNodePositions[subNodeId]) {
              const x = parentPosition.x + (index - (totalNodes - 1) / 2) * (NODE_SPACING * 0.7);
              subNodePositions[subNodeId].x = x;
              
              // Update the actual node position
              const nodeToUpdate = nodes.find(n => n.id === subNodeId);
              if (nodeToUpdate) {
                nodeToUpdate.x = x;
              }
            }
          });
        });
      };
      
      // Automatically expand all expandable nodes
      expandedNodes.forEach(expandedNodeId => {
        if (formulas[expandedNodeId] && nodePositions[expandedNodeId]) {
          expandNodeRecursively(expandedNodeId, nodePositions[expandedNodeId], 1);
        }
      });
      
    } else {
      // Fallback: simple vertical layout for variables
      variables.forEach((variable: string, index: number) => {
        const x = SVG_CENTER_X + (index - (variables.length - 1) / 2) * NODE_SPACING;
        const y = ROOT_Y + 2 * LEVEL_HEIGHT; // Place variables at level 2
        
        nodes.push({
          id: variable,
          label: variable,
          type: 'variable',
          x,
          y
        });
        
        // Simple operation symbol based on expression
        let operation = '+';
        if (expression.includes('*')) operation = '×';
        if (expression.includes('/')) operation = '÷';
        if (expression.includes('-')) operation = '−';
        
        edges.push({
          id: `${variable}-${formulaName}`,
          from: variable,
          to: formulaName,
          operation,
          type: 'direct'
        });
      });
    }
    
    return { nodes, edges };
  };

  const DerivativesModal: React.FC<DerivativesModalProps> = ({ formulaName, onClose }) => {
    const [expandedFlowNodes, setExpandedFlowNodes] = useState<Set<string>>(new Set());
    const expressionGraph = useMemo(() => buildExpressionGraph(formulaName, expandedFlowNodes), [formulaName, expandedFlowNodes]);

    // Handle node clicks to show values or expand formulas
    const handleNodeClick = (node: GraphNode): void => {
      if (node.type !== 'operation') {
        // Check if this node has a formula (can be expanded)
        if (formulas[node.id]) {
          // Toggle expansion state
          const newExpanded = new Set(expandedFlowNodes);
          if (newExpanded.has(node.id)) {
            newExpanded.delete(node.id);
          } else {
            newExpanded.add(node.id);
          }
          setExpandedFlowNodes(newExpanded);
        } else {
          // Show value for leaf variables
          setSelectedNodeValue({ node: node.id, value: `Variable: ${node.id}` });
        }
      }
    };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Expression Analysis: {formulaName}</h3>
              <Button variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mb-6 p-4 bg-white rounded-lg border border-gray-300">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg font-bold text-black">Formula:</span>
                <code className="text-lg font-mono bg-gray-50 px-3 py-1 rounded border border-gray-200">{formulas[formulaName]}</code>
              </div>
              <div className="text-sm text-gray-600">
                Interactive tree view - click green nodes to expand full recursive formula trees
              </div>
            </div>
            
            <div className="relative bg-white border border-gray-200 rounded-lg p-6" style={{ height: expandedFlowNodes.size > 0 ? '1200px' : '700px' }}>
              <style jsx>{`
                @keyframes fadeIn {
                  from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                  to { opacity: 0.9; transform: translate(-50%, -50%) scale(1); }
                }
                .animate-fadeIn {
                  animation: fadeIn 0.3s ease-out;
                }
              `}</style>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold text-gray-700">Flow Diagram</h4>
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Interactive Tree View
                </div>
              </div>
                
                {/* Node value display */}
                {selectedNodeValue && (
                  <div className="absolute top-16 right-4 bg-white border border-gray-300 rounded-lg p-3 shadow-lg z-10 max-w-xs">
                    <div className="text-sm font-semibold text-gray-700 mb-1">{selectedNodeValue.node}</div>
                    <div className="text-xs text-gray-600 font-mono">{selectedNodeValue.value}</div>
                    <button 
                      onClick={() => setSelectedNodeValue(null)}
                      className="absolute top-1 right-1 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                
              <svg width="100%" height="100%" className="absolute inset-0">
                <defs>
                    {/* Simple black arrow marker */}
                    <marker id="blackArrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#000000" />
                  </marker>
                </defs>
                
                  {/* Render static edges */}
                  {expressionGraph.edges.map((edge: GraphEdge) => {
                    const fromNode = expressionGraph.nodes.find((n: GraphNode) => n.id === edge.from);
                    const toNode = expressionGraph.nodes.find((n: GraphNode) => n.id === edge.to);
                  if (!fromNode || !toNode) return null;
                  
                  const midX = (fromNode.x + toNode.x) / 2;
                  const midY = (fromNode.y + toNode.y) / 2;
                  
                  return (
                    <g key={edge.id}>
                        {/* Static black line */}
                      <line
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                          stroke="#000000"
                          strokeWidth="2"
                          markerEnd="url(#blackArrow)"
                        />
                      
                      {/* Operation label on edge */}
                      {edge.operation && (
                          <foreignObject x={midX - 12} y={midY - 12} width="24" height="24">
                            <div className="flex items-center justify-center w-6 h-6 bg-white border border-gray-400 rounded-full text-black text-xs font-medium">
                            {edge.operation}
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}
              </svg>
              
                {/* Render static circular nodes */}
                {expressionGraph.nodes.map((node: GraphNode) => {
                  const isExpandable = node.type !== 'operation' && formulas[node.id];
                  const isExpanded = expandedFlowNodes.has(node.id);
                  const isSubNode = node.id.includes('_'); // Check if it's a sub-node from expansion
                  // Calculate circle size based on text content
                  const calculateCircleSize = (text: string): number => {
                    // More accurate sizing based on text characteristics
                    const textLength = text.length;
                    
                    // Base sizing on character count with better scaling
                    let diameter;
                    if (textLength <= 3) {
                      diameter = 50; // Small operators like +, -, ×, ÷
                    } else if (textLength <= 6) {
                      diameter = 65; // Medium words like "Capex", "Opex"
                    } else if (textLength <= 10) {
                      diameter = 85; // Longer names like "Total_Cost"
                    } else if (textLength <= 15) {
                      diameter = 105; // Very long names like "Equipment_Cost"
                    } else {
                      diameter = 125; // Extra long names
                    }
                    
                    // Apply absolute constraints
                    const minDiameter = 50;
                    const maxDiameter = 130;
                    
                    return Math.max(minDiameter, Math.min(maxDiameter, diameter));
                  };
                  
                  const diameter = calculateCircleSize(node.label);
                  
                  const getNodeClasses = (): string => {
                    let baseClasses = "absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white cursor-pointer transition-all duration-300 overflow-hidden";
                    
                    if (node.type === 'operation') {
                      baseClasses += " cursor-default hover:bg-white border-black";
                    } else if (isExpandable) {
                      if (isExpanded) {
                        baseClasses += " border-blue-500 bg-blue-50 hover:bg-blue-100 shadow-lg";
                      } else {
                        baseClasses += " border-green-500 bg-green-50 hover:bg-green-100 shadow-md";
                      }
                    } else {
                      baseClasses += " border-black hover:bg-gray-100";
                    }
                    
                    if (isSubNode) {
                      baseClasses += " animate-fadeIn opacity-90";
                    }
                    
                    return baseClasses;
                };
                
                return (
                  <div
                    key={node.id}
                      className={getNodeClasses()}
                    style={{ 
                      left: node.x, 
                      top: node.y,
                        width: `${diameter}px`,
                        height: `${diameter}px`
                      }}
                      onClick={() => handleNodeClick(node)}
                    >
                      <div 
                        className="w-full h-full flex items-center justify-center text-center relative"
                        style={{ 
                          padding: diameter > 100 ? '12px' : diameter > 80 ? '10px' : '8px'
                        }}
                      >
                        <span 
                          className="font-semibold select-none"
                          style={{ 
                            fontSize: diameter > 100 ? '14px' : diameter > 80 ? '13px' : diameter > 60 ? '12px' : '11px',
                            lineHeight: diameter > 60 ? '1.2' : '1.1',
                            wordBreak: 'break-word',
                            textAlign: 'center',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '100%',
                            color: isExpandable ? (isExpanded ? '#1d4ed8' : '#059669') : '#000000'
                          }}
                        >
                          {node.label}
                        </span>
                        {isExpandable && (
                          <div 
                            className="absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold transform translate-x-1 translate-y-1"
                            style={{
                              backgroundColor: isExpanded ? '#1d4ed8' : '#059669',
                              fontSize: '10px'
                            }}
                          >
                            {isExpanded ? '−' : '+'}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-gray-300">
                <h4 className="font-semibold text-black mb-3">Input Variables</h4>
                <div className="space-y-2">
                  {expressionGraph.nodes.filter((n: GraphNode) => n.type === 'variable').map((node: GraphNode) => (
                    <div key={node.id} className="text-sm text-black font-mono bg-gray-50 p-2 rounded border border-gray-200">
                      {node.label}
                  </div>
                  ))}
              </div>
            </div>
            
              <div className="bg-white p-4 rounded-lg border border-gray-300">
                <h4 className="font-semibold text-black mb-3">Operations</h4>
                <div className="space-y-2">
                  {expressionGraph.nodes.filter((n: GraphNode) => n.type === 'operation').map((node: GraphNode) => (
                    <div key={node.id} className="text-sm text-black font-mono bg-gray-50 p-2 rounded border border-gray-200">
                      {node.label}
                    </div>
                  ))}
                  {expressionGraph.edges.filter((e: GraphEdge) => e.operation).map((edge: GraphEdge) => (
                    <div key={edge.id} className="text-sm text-black font-mono bg-gray-50 p-2 rounded border border-gray-200">
                      {edge.operation}
                </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-gray-300">
                <h4 className="font-semibold text-black mb-3">Result</h4>
                <div className="text-sm text-black font-mono bg-gray-50 p-2 rounded border border-gray-200">{formulaName}</div>
                <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-100 rounded border border-gray-200">
                  {formulas[formulaName]}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TreeNode: React.FC<TreeNodeProps> = ({ node, level = 0 }) => {
    const isExpanded = expandedNodes.has(node.name);
    const hasChildren = node.children && node.children.length > 0;
    const isHighlighted = highlightedPath.has(node.name);

    const getNodeColor = (): string => {
      if (isHighlighted) return 'bg-blue-100 border-blue-300';
      switch (node.type) {
        case 'formula': return 'bg-green-50 border-green-200 hover:bg-green-100';
        case 'leaf': return 'bg-gray-50 border-gray-200 hover:bg-gray-100';
        case 'circular': return 'bg-red-50 border-red-200';
        default: return 'bg-white border-gray-200';
      }
    };

    const getDepthColor = (depth: number): string => {
      const colors = ['text-blue-600', 'text-green-600', 'text-purple-600', 'text-orange-600', 'text-pink-600'];
      return colors[depth % colors.length];
    };

    return (
      <div className={`ml-${level * 4} mb-2`}>
        <div
          className={`p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer ${getNodeColor()}`}
          onMouseEnter={() => highlightPath(node.name)}
          onMouseLeave={() => setHighlightedPath(new Set())}
          onClick={() => hasChildren && toggleExpanded(node.name)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {hasChildren && (
                <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              )}
              <span className={`font-semibold ${getDepthColor(node.depth)}`}>
                {node.name}
              </span>
              <Badge variant={node.type === 'formula' ? 'default' : node.type === 'leaf' ? 'secondary' : 'destructive'}>
                {node.type}
              </Badge>
            </div>
            
            {node.type === 'formula' && (
              <div className="flex items-center space-x-2">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  {node.expression}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    setShowDerivatives(node.name);
                  }}
                  className="text-purple-600 hover:text-purple-800"
                >
                  <TrendingUp className="h-4 w-4" />
                  Analyze
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    removeFormula(node.name);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            )}
          </div>
          
          {node.operators && node.operators.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {node.operators.map((op: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {op}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-2 border-l-2 border-gray-200 pl-4">
            {node.children.map((child: TreeNode, index: number) => (
              <TreeNode key={`${child.name}-${index}`} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };
  // const previousUiMain = () => {
  //   return <FormulaManagement />;
  // };
const loadingUiMain = () =>{
  return(
    <div className="min-h-screen bg-white">
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    </div>
  )
}
  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-12">
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold text-black tracking-tight">
              Formula Tree Explorer
            </h1>
            <p className="text-xl text-gray-600 font-light max-w-3xl mx-auto leading-relaxed">
              Build, visualize, and explore mathematical formula dependencies with interactive tree expansion
            </p>
          </div>
        </div>
      </div>
      {/* Solution Configuration */}
      {loading ? loadingUiMain() : 
      (
        <SolutionConfigurationPages solutions={solutions} />
      )}
      {/* Main Content */}
 
    </div>
  );
};

export default RecursiveFormulaTree;