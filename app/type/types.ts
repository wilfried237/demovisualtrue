// Category - For color-coded categorization
// DropdownOption - For parameter dropdown selections
// UserInterface - For UI configuration settings
// Parameter - Complete parameter definition with all properties
// Calculation - Calculation objects with formulas and results
// SolutionConfiguration - Main interface containing all solution data

// Category interface for both parameters and calculations
interface Category {
    color: string;
    name: string;
  }
  
  // Dropdown option interface for parameters
  interface DropdownOption {
    key: string;
    value: string;
  }
  
  // User interface configuration for parameters
  interface UserInterface {
    category: string;
    is_advanced: boolean;
    type: string;
  }
  
  // Parameter interface
  interface Parameter {
    _id?: string; // ObjectId (optional)
    category: Category;
    conditional_rules: {
        condition: string;
        value: string;
    }[]; // Array of conditional rules (type not specified in schema)
    description: string;
    display_type: string;
    dropdown_options: DropdownOption[];
    id: string;
    information: string;
    input_type: string;
    is_modifiable: boolean;
    level: string;
    name: string;
    output: boolean;
    provided_by: string;
    range_max: string;
    range_min: string;
    test_value: string;
    unit: string;
    user_interface: UserInterface;
    value: string;
  }
  
  // Calculation interface
  interface Calculation {
    category: Category;
    description: string;
    display_result?: boolean; // Optional field from schema variations
    displayResult?: boolean; // Alternative field name from schema
    formula: string;
    id: string;
    level: number;
    name: string;
    output: boolean;
    result: string | number | null;
    status: string;
    units: string;
  }
  
  // Main solution configuration interface
  interface SolutionConfiguration {
    _id: string; // ObjectId
    calculations: Calculation[];
    client_id: string;
    created_at: Date;
    created_by: string;
    id?: string; // Optional field
    industry_id: string;
    is_creating_new_solution: boolean;
    is_creating_new_variant: boolean;
    new_variant_description: string;
    new_variant_icon: string;
    new_variant_name: string;
    parameters: Parameter[];
    selected_solution_id: string;
    selected_solution_variant_id: string;
    solution_description: string;
    solution_icon: string;
    solution_name: string;
    status: string;
    technology_id: string;
    updated_at: Date;
  }
 interface ASTNode {
    type: string;
    left?: ASTNode | string | number;
    right?: ASTNode | string | number;
    operand?: ASTNode | string | number;
}
  // Type definitions
interface FormulaMap {
    [key: string]: string;
  }
  
  interface ParsedExpression {
    variables: string[];
    operators: string[];
    tokens: string[];
    ast?: ASTNode;
  }
  

  interface BinaryOpNode extends ASTNode {
    type: 'Add' | 'Subtract' | 'Multiply' | 'Divide' | 'Power';
    left: ASTNode | string | number;
    right: ASTNode | string | number;
  }
  
  interface UnaryOpNode extends ASTNode {
    type: string; // e.g., 'Unary_USub', 'Unary_UAdd'
    operand: ASTNode | string | number;
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
  
  interface Operation {
    id: string;
    operation: string;
    leftVar: string;
    rightVar: string;
    x: number;
    y: number;
  }
  
  interface DerivativesModalProps {
    formulaName: string;
    onClose: () => void;
  }
  
  interface TreeNodeProps {
    node: TreeNode;
    level?: number;
  }
  
  // Export all interfaces
  export type {
    Category,
    DropdownOption,
    UserInterface,
    Parameter,
    Calculation,
    SolutionConfiguration,
    ASTNode,
    FormulaMap,
    ParsedExpression,
    BinaryOpNode,
    UnaryOpNode,
    TreeNode,
    GraphNode,
    GraphEdge,
    ExpressionGraph,
    DerivativesModalProps,
    TreeNodeProps
  };