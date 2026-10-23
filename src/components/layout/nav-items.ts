import {
  BarChart3,
  Building2,
  History,
  KanbanSquare,
  LayoutDashboard,
  Lightbulb,
  Radar,
  Settings,
  Target,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * `false` enquanto a área não foi implementada: o item aparece desabilitado
   * e identificado como "Em breve", nunca como funcionalidade pronta.
   */
  available: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, available: true },
  { label: "Nova prospecção", href: "/prospeccao", icon: Radar, available: false },
  { label: "Pesquisas anteriores", href: "/pesquisas", icon: History, available: false },
  { label: "Empresas", href: "/empresas", icon: Building2, available: true },
  { label: "Oportunidades", href: "/oportunidades", icon: Target, available: true },
  { label: "Pipeline comercial", href: "/pipeline", icon: KanbanSquare, available: true },
  { label: "Produtos e ideias", href: "/produtos", icon: Lightbulb, available: false },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3, available: false },
  { label: "Configurações", href: "/configuracoes", icon: Settings, available: true },
];
