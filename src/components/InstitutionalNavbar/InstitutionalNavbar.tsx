import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "../Logo/Logo";
import Button from "../Button/Button";
import "../Button/Button.css";
import "./InstitutionalNavbar.css";

const sections = [["funcionalidades", "Funcionalidades"], ["modalidades", "Modalidades"], ["como-funciona", "Como funciona"], ["assinatura", "Assinatura"]];
export default function InstitutionalNavbar() {
  const [open, setOpen] = useState(false);
  return <header className="institutional-nav" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
    <div className="institutional-container institutional-nav__inner">
      <a href="#home" aria-label="Gymnasion — início"><Logo /></a>
      {/* No celular/tablet o "Entrar" fica sempre visível, fora do menu recolhido */}
      <div className="institutional-nav__compact">
        <Link className="button button--secondary institutional-nav__login" to="/login">Entrar</Link>
        <Button variant="ghost" className="institutional-nav__toggle" aria-expanded={open} aria-controls="institutional-menu" aria-label={open ? "Fechar menu" : "Abrir menu"} onClick={() => setOpen(value => !value)}>
          {open ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </Button>
      </div>
      <nav id="institutional-menu" aria-label="Navegação principal" className={`institutional-nav__menu ${open ? "institutional-nav__menu--open" : ""}`}>
        <div className="institutional-nav__links">{sections.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>{label}</a>)}</div>
        <div className="institutional-nav__actions"><Link className="button button--ghost institutional-nav__menu-login" to="/login">Entrar</Link><Link className="button button--primary" to="/cadastro">Começar agora</Link></div>
      </nav>
    </div>
  </header>;
}
