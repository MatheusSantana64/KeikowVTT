import { useEffect, useRef } from 'react';

export interface ItemDoMenu {
  readonly rotulo: string;
  readonly aoEscolher: () => void;
  readonly desativado?: boolean;
  /** Uma explicação ao passar o mouse, como o motivo de estar desativado. */
  readonly dica?: string;
  /** Traço antes deste item, separando grupos. */
  readonly separar?: boolean;
}

export interface MenuAberto {
  readonly x: number;
  readonly y: number;
  readonly titulo: string;
  readonly itens: readonly ItemDoMenu[];
}

/** O menu do botão direito: some ao clicar fora, ao escolher um item ou com Esc. */
export function MenuDeContexto({ menu, aoFechar }: { readonly menu: MenuAberto; readonly aoFechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (evento: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) {
        aoFechar();
      }
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        aoFechar();
      }
    };
    const temporizador = setTimeout(() => document.addEventListener('mousedown', fora));
    window.addEventListener('keydown', tecla, true);
    caixa.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      clearTimeout(temporizador);
      document.removeEventListener('mousedown', fora);
      window.removeEventListener('keydown', tecla, true);
    };
  }, [aoFechar]);

  const largura = 240;
  const altura = 32 + menu.itens.length * 30;
  return (
    <div
      ref={caixa}
      className="menu-contexto"
      role="menu"
      aria-label={menu.titulo}
      style={{
        left: Math.max(8, Math.min(menu.x, window.innerWidth - largura - 8)),
        top: Math.max(8, Math.min(menu.y, window.innerHeight - altura - 8)),
        width: largura,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <strong>{menu.titulo}</strong>
      {menu.itens.map((item, i) => (
        <button
          key={`${i}-${item.rotulo}`}
          type="button"
          role="menuitem"
          className={item.separar ? 'menu-separado' : undefined}
          disabled={item.desativado}
          title={item.dica}
          onClick={() => {
            aoFechar();
            item.aoEscolher();
          }}
        >
          {item.rotulo}
        </button>
      ))}
    </div>
  );
}
