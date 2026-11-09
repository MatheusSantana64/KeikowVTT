import { useEffect, useId, useState, type ReactNode } from 'react';

interface CampoProps {
  readonly rotulo: string;
  readonly largo?: boolean;
}

function Moldura({ rotulo, largo, children }: CampoProps & { readonly children: ReactNode }) {
  return (
    <label className={largo ? 'campo campo-largo' : 'campo'}>
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

export function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  multilinha = false,
  largo = multilinha,
  dica,
}: CampoProps & {
  readonly valor: string;
  readonly aoMudar: (valor: string) => void;
  readonly multilinha?: boolean;
  readonly dica?: string;
}) {
  return (
    <Moldura rotulo={rotulo} largo={largo}>
      {multilinha ? (
        <textarea value={valor} placeholder={dica} rows={5} onChange={(e) => aoMudar(e.target.value)} />
      ) : (
        <input type="text" value={valor} placeholder={dica} onChange={(e) => aoMudar(e.target.value)} />
      )}
    </Moldura>
  );
}

/**
 * Número que aceita estados intermediários enquanto se digita, como um campo vazio ou um "-".
 * Só envia valores válidos.
 */
export function CampoNumero({
  rotulo,
  valor,
  aoMudar,
  minimo = -Infinity,
  maximo = Infinity,
  inteiro = false,
  vazioPermitido = false,
}: CampoProps & {
  readonly valor: number | null;
  readonly aoMudar: (valor: number | null) => void;
  readonly minimo?: number;
  readonly maximo?: number;
  readonly inteiro?: boolean;
  /** Campo vazio significa "nenhum valor". */
  readonly vazioPermitido?: boolean;
}) {
  const [rascunho, setRascunho] = useState(valor === null ? '' : String(valor));

  // Mantém o campo em dia quando o valor muda por fora, como num Ctrl+Z.
  useEffect(() => {
    const atual = rascunho.trim() === '' ? null : Number(rascunho);
    if (atual !== valor) {
      setRascunho(valor === null ? '' : String(valor));
    }
    // Só deve reagir a mudanças do valor, não do rascunho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const mudar = (texto: string) => {
    setRascunho(texto);
    if (texto.trim() === '') {
      if (vazioPermitido) {
        aoMudar(null);
      }
      return;
    }
    const numero = Number(texto.replace(',', '.'));
    if (Number.isFinite(numero) && numero >= minimo && numero <= maximo && (!inteiro || Number.isInteger(numero))) {
      aoMudar(numero);
    }
  };

  return (
    <Moldura rotulo={rotulo}>
      <input type="text" inputMode="decimal" value={rascunho} onChange={(e) => mudar(e.target.value)} />
    </Moldura>
  );
}

export function CampoOpcoes<T extends string>({
  rotulo,
  valor,
  rotulos,
  aoMudar,
  nenhum,
}: CampoProps & {
  readonly valor: T | null;
  readonly rotulos: Readonly<Record<T, string>>;
  readonly aoMudar: (valor: T | null) => void;
  /** Texto da opção "nenhum". Sem ele, a opção não aparece. */
  readonly nenhum?: string;
}) {
  const opcoes = Object.keys(rotulos) as T[];
  return (
    <Moldura rotulo={rotulo}>
      <select
        value={valor ?? ''}
        onChange={(e) => aoMudar(e.target.value === '' ? null : (e.target.value as T))}
      >
        {nenhum !== undefined && <option value="">{nenhum}</option>}
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {rotulos[opcao]}
          </option>
        ))}
      </select>
    </Moldura>
  );
}

export function CampoMarcar({
  rotulo,
  valor,
  aoMudar,
}: {
  readonly rotulo: string;
  readonly valor: boolean;
  readonly aoMudar: (valor: boolean) => void;
}) {
  return (
    <label className="campo-marcar">
      <input type="checkbox" checked={valor} onChange={(e) => aoMudar(e.target.checked)} />
      {rotulo}
    </label>
  );
}

/** Uma lista de textos, um por linha. Linhas vazias são ignoradas. */
export function CampoLinhas({
  rotulo,
  valores,
  aoMudar,
}: CampoProps & {
  readonly valores: readonly string[];
  readonly aoMudar: (valores: string[]) => void;
}) {
  const limpar = (texto: string) =>
    texto
      .split('\n')
      .map((linha) => linha.trim())
      .filter((linha) => linha !== '');
  const [rascunho, setRascunho] = useState(valores.join('\n'));

  useEffect(() => {
    if (limpar(rascunho).join('\n') !== valores.join('\n')) {
      setRascunho(valores.join('\n'));
    }
    // Só deve reagir a mudanças dos valores, não do rascunho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores]);

  return (
    <Moldura rotulo={rotulo} largo>
      <textarea
        rows={3}
        value={rascunho}
        placeholder="Um por linha"
        onChange={(e) => {
          setRascunho(e.target.value);
          aoMudar(limpar(e.target.value));
        }}
      />
    </Moldura>
  );
}

/** Marca, entre as entradas disponíveis, as que fazem parte de uma lista. */
export function CampoReferencias({
  rotulo,
  selecionadas,
  disponiveis,
  aoMudar,
}: {
  readonly rotulo: string;
  readonly selecionadas: readonly string[];
  readonly disponiveis: readonly { readonly id: string; readonly nome: string }[];
  readonly aoMudar: (ids: string[]) => void;
}) {
  const idBase = useId();
  const conhecidas = new Set(disponiveis.map((d) => d.id));
  const sumidas = selecionadas.filter((id) => !conhecidas.has(id));
  const alternar = (id: string, marcar: boolean) =>
    aoMudar(marcar ? [...selecionadas, id] : selecionadas.filter((s) => s !== id));

  return (
    <fieldset className="campo-largo campo-referencias" aria-labelledby={idBase}>
      <span id={idBase}>{rotulo}</span>
      {disponiveis.length === 0 && sumidas.length === 0 && (
        <p className="tela-dica">Nenhuma entrada desse tipo no compêndio ainda.</p>
      )}
      <div>
        {disponiveis.map((d) => (
          <CampoMarcar
            key={d.id}
            rotulo={d.nome || '(sem nome)'}
            valor={selecionadas.includes(d.id)}
            aoMudar={(marcar) => alternar(d.id, marcar)}
          />
        ))}
        {sumidas.map((id) => (
          <CampoMarcar key={id} rotulo="(entrada apagada)" valor aoMudar={() => alternar(id, false)} />
        ))}
      </div>
    </fieldset>
  );
}

/** Uma lista de itens editáveis, com botões para acrescentar e remover. */
export function EditorLista<T>({
  rotulo,
  itens,
  aoMudar,
  criar,
  renderizar,
  rotuloAdicionar,
  podeAdicionar = true,
}: {
  readonly rotulo: string;
  readonly itens: readonly T[];
  readonly aoMudar: (itens: T[]) => void;
  readonly criar: () => T;
  readonly renderizar: (item: T, mudar: (novo: T) => void) => ReactNode;
  readonly rotuloAdicionar: string;
  readonly podeAdicionar?: boolean;
}) {
  return (
    <fieldset className="campo-largo editor-lista">
      <span>{rotulo}</span>
      {itens.map((item, indice) => (
        <div key={indice} className="editor-lista-item">
          <div className="editor-lista-campos">
            {renderizar(item, (novo) => aoMudar(itens.map((i, j) => (j === indice ? novo : i))))}
          </div>
          <button type="button" onClick={() => aoMudar(itens.filter((_, j) => j !== indice))}>
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        className="editor-lista-adicionar"
        disabled={!podeAdicionar}
        onClick={() => aoMudar([...itens, criar()])}
      >
        {rotuloAdicionar}
      </button>
    </fieldset>
  );
}
