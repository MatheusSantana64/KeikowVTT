import { useEffect, useRef } from 'react';
import type { Calculado } from '../core/calculadora';
import type { OperacaoEfeito } from '../core/entradas';
import { formatarNumero } from '../core/formulas';

const OPERACAO: Readonly<Record<OperacaoEfeito, string>> = {
  somar: 'soma',
  minimo: 'no mínimo',
  definir: 'define',
};

export function comSinal(valor: number): string {
  if (!Number.isFinite(valor)) {
    return formatarNumero(valor);
  }
  return valor >= 0 ? `+${formatarNumero(valor)}` : `−${formatarNumero(-valor)}`;
}

export interface Explicando {
  readonly rotulo: string;
  readonly calculado: Calculado;
  /** Uma linha a mais, como de onde vem a proficiência. */
  readonly nota?: string;
  /** Onde o número foi clicado, para a janelinha aparecer perto dele. */
  readonly x: number;
  readonly y: number;
}

/** A janelinha "de onde vem": as parcelas da regra e o que cada efeito fez. */
export function ExplicacaoValor({ explicando, aoFechar }: { readonly explicando: Explicando; readonly aoFechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const { calculado } = explicando;

  useEffect(() => {
    const fora = (evento: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) {
        aoFechar();
      }
    };
    // Espera o clique que abriu a janelinha terminar antes de escutar.
    const temporizador = setTimeout(() => document.addEventListener('mousedown', fora));
    return () => {
      clearTimeout(temporizador);
      document.removeEventListener('mousedown', fora);
    };
  }, [aoFechar]);

  const largura = 300;
  const esquerda = Math.min(explicando.x, window.innerWidth - largura - 12);
  const topo = Math.min(explicando.y + 8, window.innerHeight - 200);

  return (
    <div
      ref={caixa}
      className="explicacao"
      role="dialog"
      aria-label={`De onde vem: ${explicando.rotulo}`}
      style={{ left: Math.max(8, esquerda), top: topo, width: largura }}
    >
      <header>
        <strong>{explicando.rotulo}</strong>
        <span>{calculado.ok ? formatarNumero(calculado.valor) : '—'}</span>
      </header>
      {!calculado.ok && <p className="campo-problema">{calculado.erro}</p>}
      {calculado.ok && (
        <ul>
          {calculado.partes.map((parte, i) => (
            <li key={`p${i}`}>
              <span>{parte.texto}</span>
              <span>{i === 0 ? formatarNumero(parte.valor) : comSinal(parte.valor)}</span>
            </li>
          ))}
          {calculado.ajustes.length > 0 && (
            <li className="explicacao-subtotal">
              <span>pela regra</span>
              <span>{formatarNumero(calculado.base)}</span>
            </li>
          )}
          {calculado.ajustes.map((ajuste, i) => (
            <li key={`a${i}`} className={ajuste.aplicado ? '' : 'explicacao-ignorado'}>
              <span>
                {ajuste.fonte} ({OPERACAO[ajuste.operacao]})
                {!ajuste.aplicado && (ajuste.erro ? ` — erro: ${ajuste.erro}` : ' — não contou')}
              </span>
              <span>{ajuste.valor === null ? '—' : ajuste.operacao === 'somar' ? comSinal(ajuste.valor) : formatarNumero(ajuste.valor)}</span>
            </li>
          ))}
        </ul>
      )}
      {explicando.nota && <p className="tela-dica">{explicando.nota}</p>}
    </div>
  );
}
