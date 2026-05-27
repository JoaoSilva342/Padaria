"use client"

import Link from "next/link"
import { ShoppingCart, User, LogOut, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/contexts/auth-context"
import { useCart } from "@/contexts/cart-context"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

  const { user, signOut } = useAuth()
  export function Header() {
    const { user, signOut } = useAuth()
    const { itemCount } = useCart()
    const { theme, setTheme } = useTheme()

    return (
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          {/* ...removido botão de tema... */}
          <Link href="/" className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-bold text-primary">Padaria Portuguesa</h1>
          </Link>

          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
              Início
            </Link>
            <Link href="/produtos" className="text-sm font-medium hover:text-primary transition-colors">
              Produtos
            </Link>
            <Link href="/receitas" className="text-sm font-medium hover:text-primary transition-colors">
              Receitas
            </Link>
            <Link href="/como-usar" className="text-sm font-medium hover:text-primary transition-colors">
              Como usar
            </Link>
            <Link href="/sobre" className="text-sm font-medium hover:text-primary transition-colors">
              Sobre
            </Link>
            <Link href="/orders" className="text-sm font-medium hover:text-primary transition-colors">
              Encomendas
            </Link>
            {user?.isAdmin && (
              <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors">
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {itemCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="font-medium">{user.displayName}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <Button variant="default" size="sm">
                  Entrar
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>
    )
