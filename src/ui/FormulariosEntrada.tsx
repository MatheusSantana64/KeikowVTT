import { useEffect, useState } from 'react';
import {
  ATRIBUTOS,
  NIVEIS_DA_TABELA,
  type BlocoDeTexto,
  type ColunaTabela,
  type DadosArma,
  type DadosArmadura,
  type DadosPorTipo,
  type Efeito,
  type Entrada,
  type OperacaoEfeito,
  type EntradaDe,
  type TipoEntrada,
} from '../core/entradas';
import { normalizarNome } from '../core/formulas';
import { idSalvaguarda, NOME_NIVEL_DA_CLASSE, problemaNaFormula } from '../core/regras';
import { REGRAS_PADRAO } from '../core/regrasPadrao';
import {
  CampoFormula,
  CampoLinhas,
  CampoMarcar,
  CampoNumero,
  CampoOpcoes,
  CampoReferencias,
  CampoTexto,
  EditorLista,
} from './camposFormulario';
import {
  ROTULO_ALCANCE_TIPO,
  ROTULO_ATRIBUTO,
  ROTULO_CATEGORIA,
  ROTULO_DOMINIO,
  ROTULO_ESCOLA,
  ROTULO_MOEDA,
  ROTULO_PESO_ARMADURA,
  ROTULO_RARIDADE,
  ROTULO_RECARGA,
  ROTULO_TAMANHO,
} from './rotulosCompendio';

export interface PropsFormulario<T extends TipoEntrada> {
  readonly dados: DadosPorTipo[T];
  /** Envia só os campos que mudaram. `campo` agrupa a digitação num único passo de desfazer. */
  readonly mudar: (parcial: Partial<DadosPorTipo[T]>, campo: string) => void;
  /** Outras entradas do compêndio, para formar listas de referências. */
  readonly todas: readonly Entrada[];
}

const ARMA_INICIAL: DadosArma = {
  dominio: 'simples',
  alcanceTipo: 'corpo-a-corpo',
  dano: '1d4',
  tipoDano: '',
  danoVersatil: null,
  alcance: null,
  propriedades: [],
};

const ARMADURA_INICIAL: DadosArmadura = {
  peso: 'leve',
  caBase: 11,
  usaDestreza: true,
  destrezaMaxima: null,
  forcaMinima: 0,
  desvantagemFurtividade: false,
};

const ROTULO_DADO_VIDA = { '6': 'd6', '8': 'd8', '10': 'd10', '12': 'd12' } as const;

function referencias(todas: readonly Entrada[], tipo: TipoEntrada) {
  return todas
    .filter((e) => e.tipo === tipo)
    .map((e) => ({ id: e.id, nome: e.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function EditorBlocos({
  rotulo,
  blocos,
  aoMudar,
}: {
  readonly rotulo: string;
  readonly blocos: readonly BlocoDeTexto[];
  readonly aoMudar: (blocos: BlocoDeTexto[]) => void;
}) {
  return (
    <EditorLista
      rotulo={rotulo}
      itens={blocos}
      aoMudar={aoMudar}
      criar={() => ({ nome: '', descricao: '' })}
      rotuloAdicionar="+ Adicionar"
      renderizar={(bloco, mudar) => (
        <>
          <CampoTexto rotulo="Nome" valor={bloco.nome} aoMudar={(nome) => mudar({ ...bloco, nome })} />
          <CampoTexto
            rotulo="Descrição"
            multilinha
            valor={bloco.descricao}
            aoMudar={(descricao) => mudar({ ...bloco, descricao })}
          />
        </>
      )}
    />
  );
}

// Por enquanto as fórmulas são conferidas com as regras que acompanham o programa.
// Quando a campanha tiver as próprias regras (passo 12), elas entram aqui.

/** Dano, dados de vida e afins: podem rolar dados e citar a ficha, como `1d8 + mod(FOR)`. Vazio é aceito. */
function conferirDados(texto: string): string | null {
  return texto.trim() === '' ? null : problemaNaFormula(REGRAS_PADRAO, texto, { colunas: null, dados: 'permitidos' });
}

/**
 * Usos de uma habilidade: um número calculado, sem dados. Pode citar o nível e a tabela da classe;
 * a coluna só é conferida quando a habilidade é usada, porque ela pode estar em mais de uma classe.
 */
function conferirUsos(texto: string): string | null {
  if (texto.trim() === '') {
    return 'Escreva quantos usos, como 1 ou mod(CAR).';
  }
  return problemaNaFormula(REGRAS_PADRAO, texto, {
    extras: [NOME_NIVEL_DA_CLASSE],
    colunas: 'qualquer',
    dados: 'proibidos',
  });
}

function FormularioArma({ arma, mudar }: { arma: DadosArma; mudar: (arma: DadosArma) => void }) {
  return (
    <>
      <CampoOpcoes rotulo="Domínio" valor={arma.dominio} rotulos={ROTULO_DOMINIO} aoMudar={(v) => v && mudar({ ...arma, dominio: v })} />
      <CampoOpcoes
        rotulo="Uso"
        valor={arma.alcanceTipo}
        rotulos={ROTULO_ALCANCE_TIPO}
        aoMudar={(v) => v && mudar({ ...arma, alcanceTipo: v })}
      />
      <CampoFormula rotulo="Dano" dica="1d8" valor={arma.dano} conferir={conferirDados} aoMudar={(dano) => mudar({ ...arma, dano })} />
      <CampoTexto rotulo="Tipo de dano" valor={arma.tipoDano} aoMudar={(tipoDano) => mudar({ ...arma, tipoDano })} />
      <CampoFormula
        rotulo="Dano versátil (opcional)"
        valor={arma.danoVersatil ?? ''}
        conferir={conferirDados}
        aoMudar={(v) => mudar({ ...arma, danoVersatil: v.trim() === '' ? null : v })}
      />
      <CampoMarcar
        rotulo="Tem alcance (arremesso ou distância)"
        valor={arma.alcance !== null}
        aoMudar={(sim) => mudar({ ...arma, alcance: sim ? { normal: 6, longo: null } : null })}
      />
      {arma.alcance && (
        <>
          <CampoNumero
            rotulo="Alcance normal (m)"
            minimo={0}
            valor={arma.alcance.normal}
            aoMudar={(normal) => normal !== null && arma.alcance && mudar({ ...arma, alcance: { ...arma.alcance, normal } })}
          />
          <CampoNumero
            rotulo="Alcance longo (m, opcional)"
            minimo={0}
            vazioPermitido
            valor={arma.alcance.longo}
            aoMudar={(longo) => arma.alcance && mudar({ ...arma, alcance: { ...arma.alcance, longo } })}
          />
        </>
      )}
      <CampoLinhas rotulo="Propriedades" valores={arma.propriedades} aoMudar={(propriedades) => mudar({ ...arma, propriedades })} />
    </>
  );
}

function FormularioArmadura({
  armadura,
  mudar,
}: {
  armadura: DadosArmadura;
  mudar: (armadura: DadosArmadura) => void;
}) {
  return (
    <>
      <CampoOpcoes
        rotulo="Peso"
        valor={armadura.peso}
        rotulos={ROTULO_PESO_ARMADURA}
        aoMudar={(v) => v && mudar({ ...armadura, peso: v })}
      />
      <CampoNumero
        rotulo={armadura.peso === 'escudo' ? 'Bônus na CA' : 'CA base'}
        inteiro
        valor={armadura.caBase}
        aoMudar={(v) => v !== null && mudar({ ...armadura, caBase: v })}
      />
      <CampoMarcar rotulo="Soma a Destreza" valor={armadura.usaDestreza} aoMudar={(v) => mudar({ ...armadura, usaDestreza: v })} />
      {armadura.usaDestreza && (
        <CampoNumero
          rotulo="Destreza máxima (vazio: sem limite)"
          inteiro
          minimo={0}
          vazioPermitido
          valor={armadura.destrezaMaxima}
          aoMudar={(v) => mudar({ ...armadura, destrezaMaxima: v })}
        />
      )}
      <CampoNumero
        rotulo="Força mínima"
        inteiro
        minimo={0}
        valor={armadura.forcaMinima}
        aoMudar={(v) => v !== null && mudar({ ...armadura, forcaMinima: v })}
      />
      <CampoMarcar
        rotulo="Desvantagem em Furtividade"
        valor={armadura.desvantagemFurtividade}
        aoMudar={(v) => mudar({ ...armadura, desvantagemFurtividade: v })}
      />
    </>
  );
}

export function FormularioItem({ dados, mudar }: PropsFormulario<'item'>) {
  return (
    <>
      <CampoOpcoes rotulo="Categoria" valor={dados.categoria} rotulos={ROTULO_CATEGORIA} aoMudar={(v) => v && mudar({ categoria: v }, 'categoria')} />
      <CampoNumero rotulo="Peso (kg)" minimo={0} valor={dados.peso} aoMudar={(v) => v !== null && mudar({ peso: v }, 'peso')} />
      <CampoOpcoes
        rotulo="Raridade"
        nenhum="Nenhuma"
        valor={dados.raridade}
        rotulos={ROTULO_RARIDADE}
        aoMudar={(raridade) => mudar({ raridade }, 'raridade')}
      />
      <CampoMarcar
        rotulo="Tem preço"
        valor={dados.custo !== null}
        aoMudar={(sim) => mudar({ custo: sim ? { quantidade: 1, moeda: 'po' } : null }, 'custo')}
      />
      {dados.custo && (
        <>
          <CampoNumero
            rotulo="Preço"
            minimo={0}
            valor={dados.custo.quantidade}
            aoMudar={(v) => v !== null && dados.custo && mudar({ custo: { ...dados.custo, quantidade: v } }, 'custo')}
          />
          <CampoOpcoes
            rotulo="Moeda"
            valor={dados.custo.moeda}
            rotulos={ROTULO_MOEDA}
            aoMudar={(v) => v && dados.custo && mudar({ custo: { ...dados.custo, moeda: v } }, 'moeda')}
          />
        </>
      )}
      <CampoMarcar rotulo="Requer sintonia" valor={dados.requerSintonia} aoMudar={(v) => mudar({ requerSintonia: v }, 'sintonia')} />
      <CampoMarcar rotulo="Empilhável (várias unidades)" valor={dados.empilhavel} aoMudar={(v) => mudar({ empilhavel: v }, 'empilhavel')} />

      <h3 className="campo-largo">Arma</h3>
      <CampoMarcar rotulo="Funciona como arma" valor={dados.arma !== null} aoMudar={(sim) => mudar({ arma: sim ? ARMA_INICIAL : null }, 'arma')} />
      {dados.arma && <FormularioArma arma={dados.arma} mudar={(arma) => mudar({ arma }, 'arma')} />}

      <h3 className="campo-largo">Proteção</h3>
      <CampoMarcar
        rotulo="Funciona como armadura ou escudo"
        valor={dados.armadura !== null}
        aoMudar={(sim) => mudar({ armadura: sim ? ARMADURA_INICIAL : null }, 'armadura')}
      />
      {dados.armadura && <FormularioArmadura armadura={dados.armadura} mudar={(armadura) => mudar({ armadura }, 'armadura')} />}
    </>
  );
}

export function FormularioMagia({ dados, mudar, todas }: PropsFormulario<'magia'>) {
  return (
    <>
      <CampoNumero rotulo="Nível (0 para truque)" inteiro minimo={0} maximo={9} valor={dados.nivel} aoMudar={(v) => v !== null && mudar({ nivel: v }, 'nivel')} />
      <CampoOpcoes rotulo="Escola" valor={dados.escola} rotulos={ROTULO_ESCOLA} aoMudar={(v) => v && mudar({ escola: v }, 'escola')} />
      <CampoTexto rotulo="Tempo de conjuração" valor={dados.tempoConjuracao} aoMudar={(v) => mudar({ tempoConjuracao: v }, 'tempo')} />
      <CampoTexto rotulo="Alcance" valor={dados.alcance} aoMudar={(v) => mudar({ alcance: v }, 'alcance')} />
      <CampoTexto rotulo="Duração" valor={dados.duracao} aoMudar={(v) => mudar({ duracao: v }, 'duracao')} />
      <CampoMarcar rotulo="Concentração" valor={dados.concentracao} aoMudar={(v) => mudar({ concentracao: v }, 'concentracao')} />
      <CampoMarcar rotulo="Ritual" valor={dados.ritual} aoMudar={(v) => mudar({ ritual: v }, 'ritual')} />
      <CampoMarcar
        rotulo="Componente verbal"
        valor={dados.componentes.verbal}
        aoMudar={(v) => mudar({ componentes: { ...dados.componentes, verbal: v } }, 'componentes')}
      />
      <CampoMarcar
        rotulo="Componente somático"
        valor={dados.componentes.somatico}
        aoMudar={(v) => mudar({ componentes: { ...dados.componentes, somatico: v } }, 'componentes')}
      />
      <CampoTexto
        rotulo="Componente material (vazio: nenhum)"
        largo
        valor={dados.componentes.material ?? ''}
        aoMudar={(v) => mudar({ componentes: { ...dados.componentes, material: v.trim() === '' ? null : v } }, 'material')}
      />
      <CampoReferencias
        rotulo="Classes que podem aprender"
        selecionadas={dados.classes}
        disponiveis={referencias(todas, 'classe')}
        aoMudar={(classes) => mudar({ classes }, 'classes')}
      />
    </>
  );
}

export function FormularioHabilidade({ dados, mudar }: PropsFormulario<'habilidade'>) {
  return (
    <>
      <CampoTexto rotulo="Requisito" dica="Guerreiro 2, Anão…" valor={dados.requisito} aoMudar={(v) => mudar({ requisito: v }, 'requisito')} />
      <CampoMarcar
        rotulo="Tem usos limitados"
        valor={dados.usos !== null}
        aoMudar={(sim) => mudar({ usos: sim ? { maximo: '1', recarga: 'descanso-longo' } : null }, 'usos')}
      />
      {dados.usos && (
        <>
          <CampoFormula
            rotulo="Usos (fórmula)"
            dica="1, mod(CAR) ou tabela(furias)"
            valor={dados.usos.maximo}
            conferir={conferirUsos}
            aoMudar={(v) => dados.usos && v.trim() !== '' && mudar({ usos: { ...dados.usos, maximo: v } }, 'usos')}
          />
          <CampoOpcoes
            rotulo="Recupera em"
            valor={dados.usos.recarga}
            rotulos={ROTULO_RECARGA}
            aoMudar={(v) => v && dados.usos && mudar({ usos: { ...dados.usos, recarga: v } }, 'recarga')}
          />
        </>
      )}
    </>
  );
}

export function FormularioClasse({ dados, mudar, todas }: PropsFormulario<'classe'>) {
  const habilidades = referencias(todas, 'habilidade');
  return (
    <>
      <CampoOpcoes
        rotulo="Dado de vida"
        valor={String(dados.dadoVida) as keyof typeof ROTULO_DADO_VIDA}
        rotulos={ROTULO_DADO_VIDA}
        aoMudar={(v) => v && mudar({ dadoVida: Number(v) }, 'dadoVida')}
      />
      <CampoOpcoes
        rotulo="Atributo de conjuração"
        nenhum="Não conjura"
        valor={dados.atributoConjuracao}
        rotulos={ROTULO_ATRIBUTO}
        aoMudar={(v) => mudar({ atributoConjuracao: v }, 'conjuracao')}
      />
      <fieldset className="campo-largo campo-referencias">
        <span>Salvaguardas</span>
        <div>
          {ATRIBUTOS.map((atributo) => (
            <CampoMarcar
              key={atributo}
              rotulo={ROTULO_ATRIBUTO[atributo]}
              valor={dados.salvaguardas.includes(atributo)}
              aoMudar={(sim) =>
                mudar(
                  {
                    salvaguardas: sim
                      ? ATRIBUTOS.filter((a) => a === atributo || dados.salvaguardas.includes(a))
                      : dados.salvaguardas.filter((a) => a !== atributo),
                  },
                  'salvaguardas',
                )
              }
            />
          ))}
        </div>
      </fieldset>
      <CampoLinhas rotulo="Proficiências" valores={dados.proficiencias} aoMudar={(v) => mudar({ proficiencias: v }, 'proficiencias')} />
      <EditorLista
        rotulo="Habilidades por nível"
        itens={dados.habilidades}
        aoMudar={(v) => mudar({ habilidades: v }, 'habilidades')}
        podeAdicionar={habilidades.length > 0}
        rotuloAdicionar={habilidades.length > 0 ? '+ Adicionar habilidade' : 'Crie uma habilidade no compêndio primeiro'}
        criar={() => ({ nivel: 1, entradaId: habilidades[0]?.id ?? '' })}
        renderizar={(item, alterar) => (
          <>
            <CampoNumero
              rotulo="Nível"
              inteiro
              minimo={1}
              maximo={20}
              valor={item.nivel}
              aoMudar={(nivel) => nivel !== null && alterar({ ...item, nivel })}
            />
            <label className="campo">
              <span>Habilidade</span>
              <select value={item.entradaId} onChange={(e) => alterar({ ...item, entradaId: e.target.value })}>
                {!habilidades.some((h) => h.id === item.entradaId) && (
                  <option value={item.entradaId}>(entrada apagada)</option>
                )}
                {habilidades.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nome || '(sem nome)'}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      />
      <EditorTabela tabela={dados.tabela} mudar={(tabela, campo) => mudar({ tabela }, campo)} />
    </>
  );
}

/** O id de uma coluna, usado nas fórmulas: só muda quando o novo nome é válido e não repete outro. */
function CampoIdColuna({
  valor,
  outros,
  aoMudar,
}: {
  readonly valor: string;
  readonly outros: ReadonlySet<string>;
  readonly aoMudar: (id: string) => void;
}) {
  const [rascunho, setRascunho] = useState(valor);
  useEffect(() => setRascunho(valor), [valor]);
  const problema = !/^[a-z_][a-z0-9_]*$/.test(rascunho)
    ? 'Use letras minúsculas sem acento, números e "_".'
    : outros.has(rascunho)
      ? 'Outra coluna já tem este nome.'
      : null;
  return (
    <input
      type="text"
      className="tabela-id campo-formula"
      aria-label="Nome da coluna nas fórmulas"
      title={problema ?? `Nas fórmulas: tabela(${rascunho})`}
      aria-invalid={problema !== null}
      spellCheck={false}
      value={rascunho}
      onChange={(e) => {
        const novo = normalizarNome(e.target.value).replace(/[^a-z0-9_]/g, '_');
        setRascunho(novo);
        if (/^[a-z_][a-z0-9_]*$/.test(novo) && !outros.has(novo)) {
          aoMudar(novo);
        }
      }}
    />
  );
}

/** A tabela de nível da classe: uma coluna por recurso, uma linha por nível, cada célula uma fórmula. */
function EditorTabela({
  tabela,
  mudar,
}: {
  readonly tabela: readonly ColunaTabela[];
  readonly mudar: (tabela: ColunaTabela[], campo: string) => void;
}) {
  const ids = new Set(tabela.map((c) => c.id));
  const trocarColuna = (indice: number, nova: ColunaTabela, campo: string) =>
    mudar(
      tabela.map((c, i) => (i === indice ? nova : c)),
      campo,
    );
  const adicionar = () => {
    let id = 'nova_coluna';
    for (let n = 2; ids.has(id); n++) {
      id = `nova_coluna_${n}`;
    }
    mudar([...tabela, { id, nome: 'Nova coluna', valores: Array<string>(NIVEIS_DA_TABELA).fill('') }], 'tabela-nova');
  };
  const conferirCelula = (texto: string) =>
    texto.trim() === ''
      ? null
      : problemaNaFormula(REGRAS_PADRAO, texto, { extras: [NOME_NIVEL_DA_CLASSE], colunas: ids, dados: 'permitidos' });

  return (
    <fieldset className="campo-largo editor-tabela">
      <span>Tabela de nível</span>
      <p className="tela-dica">
        Cada coluna aparece nas fórmulas como tabela(nome), por exemplo nos usos de uma habilidade da classe. Cada
        célula é uma fórmula; vazia vale zero.
      </p>
      {tabela.length > 0 && (
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th scope="col">Nível</th>
                {tabela.map((coluna, i) => (
                  <th key={i} scope="col">
                    <input
                      type="text"
                      aria-label="Nome da coluna"
                      value={coluna.nome}
                      onChange={(e) => trocarColuna(i, { ...coluna, nome: e.target.value }, `tabela-nome-${i}`)}
                    />
                    <CampoIdColuna
                      valor={coluna.id}
                      outros={new Set([...ids].filter((id) => id !== coluna.id))}
                      aoMudar={(id) => trocarColuna(i, { ...coluna, id }, `tabela-id-${i}`)}
                    />
                    <button
                      type="button"
                      title="Apagar a coluna"
                      onClick={() => mudar(tabela.filter((_, j) => j !== i), 'tabela-apagar')}
                    >
                      Apagar
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: NIVEIS_DA_TABELA }, (_, nivel) => (
                <tr key={nivel}>
                  <th scope="row">{nivel + 1}</th>
                  {tabela.map((coluna, i) => {
                    const valor = coluna.valores[nivel] ?? '';
                    const problema = conferirCelula(valor);
                    return (
                      <td key={i}>
                        <input
                          type="text"
                          className="campo-formula"
                          aria-label={`${coluna.nome}, nível ${nivel + 1}`}
                          aria-invalid={problema !== null}
                          title={problema ?? undefined}
                          placeholder="—"
                          spellCheck={false}
                          value={valor}
                          onChange={(e) =>
                            trocarColuna(
                              i,
                              { ...coluna, valores: coluna.valores.map((v, n) => (n === nivel ? e.target.value : v)) },
                              `tabela-${i}-${nivel}`,
                            )
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" className="editor-lista-adicionar" onClick={adicionar}>
        + Coluna
      </button>
    </fieldset>
  );
}

export function FormularioEspecie({ dados, mudar, todas }: PropsFormulario<'especie'>) {
  return (
    <>
      <CampoOpcoes rotulo="Tamanho" valor={dados.tamanho} rotulos={ROTULO_TAMANHO} aoMudar={(v) => v && mudar({ tamanho: v }, 'tamanho')} />
      <CampoNumero rotulo="Deslocamento (m)" minimo={0} valor={dados.deslocamento} aoMudar={(v) => v !== null && mudar({ deslocamento: v }, 'deslocamento')} />
      <h3 className="campo-largo">Aumentos de atributo (vazio: nenhum)</h3>
      {ATRIBUTOS.map((atributo) => (
        <CampoNumero
          key={atributo}
          rotulo={ROTULO_ATRIBUTO[atributo]}
          inteiro
          vazioPermitido
          valor={dados.aumentosAtributo[atributo] ?? null}
          aoMudar={(v) => {
            const aumentos = { ...dados.aumentosAtributo };
            if (v === null) {
              delete aumentos[atributo];
            } else {
              aumentos[atributo] = v;
            }
            mudar({ aumentosAtributo: aumentos }, `aumento-${atributo}`);
          }}
        />
      ))}
      <CampoLinhas rotulo="Idiomas" valores={dados.idiomas} aoMudar={(v) => mudar({ idiomas: v }, 'idiomas')} />
      <CampoReferencias rotulo="Traços" selecionadas={dados.tracos} disponiveis={referencias(todas, 'habilidade')} aoMudar={(v) => mudar({ tracos: v }, 'tracos')} />
    </>
  );
}

export function FormularioAntecedente({ dados, mudar, todas }: PropsFormulario<'antecedente'>) {
  return (
    <>
      <CampoLinhas rotulo="Proficiências" valores={dados.proficiencias} aoMudar={(v) => mudar({ proficiencias: v }, 'proficiencias')} />
      <CampoReferencias
        rotulo="Habilidades"
        selecionadas={dados.habilidades}
        disponiveis={referencias(todas, 'habilidade')}
        aoMudar={(v) => mudar({ habilidades: v }, 'habilidades')}
      />
    </>
  );
}

export function FormularioTalento({ dados, mudar }: PropsFormulario<'talento'>) {
  return <CampoTexto rotulo="Pré-requisito" largo valor={dados.prerequisito} aoMudar={(v) => mudar({ prerequisito: v }, 'prerequisito')} />;
}

export function FormularioMonstro({ dados, mudar }: PropsFormulario<'monstro'>) {
  const pericias = Object.entries(dados.pericias).map(([nome, valor]) => ({ nome, valor }));
  return (
    <>
      <CampoOpcoes rotulo="Tamanho" valor={dados.tamanho} rotulos={ROTULO_TAMANHO} aoMudar={(v) => v && mudar({ tamanho: v }, 'tamanho')} />
      <CampoTexto rotulo="Tipo" dica="humanoide (goblinoide)" valor={dados.tipoCriatura} aoMudar={(v) => mudar({ tipoCriatura: v }, 'tipo')} />
      <CampoTexto rotulo="Alinhamento" valor={dados.alinhamento} aoMudar={(v) => mudar({ alinhamento: v }, 'alinhamento')} />
      <CampoNumero rotulo="Classe de Armadura" inteiro valor={dados.classeArmadura} aoMudar={(v) => v !== null && mudar({ classeArmadura: v }, 'ca')} />
      <CampoTexto rotulo="Origem da CA" dica="armadura natural" valor={dados.notaArmadura} aoMudar={(v) => mudar({ notaArmadura: v }, 'notaArmadura')} />
      <CampoNumero rotulo="Pontos de vida" inteiro minimo={0} valor={dados.pontosVida} aoMudar={(v) => v !== null && mudar({ pontosVida: v }, 'pv')} />
      <CampoFormula
        rotulo="Dados de vida"
        dica="2d8+2"
        valor={dados.dadosVida}
        conferir={conferirDados}
        aoMudar={(v) => mudar({ dadosVida: v }, 'dadosVida')}
      />
      <CampoTexto rotulo="Deslocamento" valor={dados.deslocamento} aoMudar={(v) => mudar({ deslocamento: v }, 'deslocamento')} />
      <CampoNumero rotulo="Nível de desafio" minimo={0} valor={dados.nivelDesafio} aoMudar={(v) => v !== null && mudar({ nivelDesafio: v }, 'nd')} />
      <CampoNumero rotulo="Experiência" inteiro minimo={0} valor={dados.experiencia} aoMudar={(v) => v !== null && mudar({ experiencia: v }, 'xp')} />

      <h3 className="campo-largo">Atributos</h3>
      {ATRIBUTOS.map((atributo) => (
        <CampoNumero
          key={atributo}
          rotulo={ROTULO_ATRIBUTO[atributo]}
          inteiro
          valor={dados.atributos[atributo]}
          aoMudar={(v) => v !== null && mudar({ atributos: { ...dados.atributos, [atributo]: v } }, `atributo-${atributo}`)}
        />
      ))}

      <h3 className="campo-largo">Salvaguardas (vazio: usa o atributo)</h3>
      {ATRIBUTOS.map((atributo) => (
        <CampoNumero
          key={atributo}
          rotulo={ROTULO_ATRIBUTO[atributo]}
          inteiro
          vazioPermitido
          valor={dados.salvaguardas[atributo] ?? null}
          aoMudar={(v) => {
            const salvaguardas = { ...dados.salvaguardas };
            if (v === null) {
              delete salvaguardas[atributo];
            } else {
              salvaguardas[atributo] = v;
            }
            mudar({ salvaguardas }, `salvaguarda-${atributo}`);
          }}
        />
      ))}

      <EditorLista
        rotulo="Perícias"
        itens={pericias}
        aoMudar={(lista) => mudar({ pericias: Object.fromEntries(lista.map((p) => [p.nome, p.valor])) }, 'pericias')}
        criar={() => ({ nome: '', valor: 0 })}
        // As perícias são guardadas pelo nome: duas sem nome virariam uma só.
        podeAdicionar={!pericias.some((p) => p.nome === '')}
        rotuloAdicionar="+ Adicionar perícia"
        renderizar={(p, alterar) => (
          <>
            <CampoTexto rotulo="Perícia" valor={p.nome} aoMudar={(nome) => alterar({ ...p, nome })} />
            <CampoNumero rotulo="Bônus" inteiro valor={p.valor} aoMudar={(valor) => valor !== null && alterar({ ...p, valor })} />
          </>
        )}
      />
      <CampoLinhas rotulo="Vulnerabilidades a dano" valores={dados.vulnerabilidades} aoMudar={(v) => mudar({ vulnerabilidades: v }, 'vulnerabilidades')} />
      <CampoLinhas rotulo="Resistências a dano" valores={dados.resistencias} aoMudar={(v) => mudar({ resistencias: v }, 'resistencias')} />
      <CampoLinhas rotulo="Imunidades a dano" valores={dados.imunidades} aoMudar={(v) => mudar({ imunidades: v }, 'imunidades')} />
      <CampoLinhas
        rotulo="Imunidades a condições"
        valores={dados.imunidadesCondicao}
        aoMudar={(v) => mudar({ imunidadesCondicao: v }, 'imunidadesCondicao')}
      />
      <CampoTexto rotulo="Sentidos" largo valor={dados.sentidos} aoMudar={(v) => mudar({ sentidos: v }, 'sentidos')} />
      <CampoTexto rotulo="Idiomas" largo valor={dados.idiomas} aoMudar={(v) => mudar({ idiomas: v }, 'idiomas')} />
      <EditorBlocos rotulo="Traços" blocos={dados.tracos} aoMudar={(v) => mudar({ tracos: v }, 'tracos')} />
      <EditorBlocos rotulo="Ações" blocos={dados.acoesDeCombate} aoMudar={(v) => mudar({ acoesDeCombate: v }, 'acoes')} />
      <EditorBlocos rotulo="Reações" blocos={dados.reacoes} aoMudar={(v) => mudar({ reacoes: v }, 'reacoes')} />
      <EditorBlocos rotulo="Ações lendárias" blocos={dados.acoesLendarias} aoMudar={(v) => mudar({ acoesLendarias: v }, 'lendarias')} />
    </>
  );
}

const ROTULO_OPERACAO: Readonly<Record<OperacaoEfeito, string>> = {
  somar: 'Soma',
  minimo: 'No mínimo',
  definir: 'Define (vence tudo)',
};

const ROTULO_QUANDO: Readonly<Record<Efeito['quando'], string>> = {
  sempre: 'Sempre (só por ter)',
  equipado: 'Quando equipado',
  sintonizado: 'Quando sintonizado',
};

/** Os valores da ficha que um efeito pode mudar, em grupos, com o nome legível. */
function alvosDosEfeitos(): { grupo: string; opcoes: { id: string; nome: string }[] }[] {
  const r = REGRAS_PADRAO;
  return [
    { grupo: 'Atributos', opcoes: ATRIBUTOS.map((a) => ({ id: a, nome: r.atributos[a] })) },
    { grupo: 'Valores', opcoes: r.valores.map((v) => ({ id: v.id, nome: v.nome })) },
    { grupo: 'Salvaguardas', opcoes: ATRIBUTOS.map((a) => ({ id: idSalvaguarda(a), nome: `Salvaguarda de ${r.atributos[a]}` })) },
    { grupo: 'Perícias', opcoes: r.pericias.map((p) => ({ id: p.id, nome: p.nome })) },
  ];
}

/**
 * Os efeitos de uma entrada: o que ela muda na ficha de quem a tem.
 * Em itens, cada efeito diz se vale sempre, ao equipar ou ao sintonizar.
 */
export function EditorEfeitos({
  entrada,
  mudar,
}: {
  readonly entrada: Entrada;
  readonly mudar: (efeitos: Efeito[], campo: string) => void;
}) {
  const ehItem = entrada.tipo === 'item';
  const grupos = alvosDosEfeitos();
  const conhecidos = new Set(grupos.flatMap((g) => g.opcoes.map((o) => o.id)));
  // Habilidades de classe podem ler o nível e a tabela da classe; a coluna é conferida ao usar.
  const conferir = (texto: string) =>
    problemaNaFormula(REGRAS_PADRAO, texto, {
      extras: entrada.tipo === 'habilidade' ? [NOME_NIVEL_DA_CLASSE] : [],
      colunas: entrada.tipo === 'habilidade' ? 'qualquer' : null,
      dados: 'proibidos',
    });
  const trocar = (indice: number, novo: Efeito, campo: string) =>
    mudar(
      entrada.efeitos.map((e, i) => (i === indice ? novo : e)),
      `efeito-${novo.id}-${campo}`,
    );

  return (
    <fieldset className="campo-largo editor-lista editor-efeitos">
      <span>Efeitos na ficha</span>
      <p className="tela-dica">
        O que esta entrada muda em quem a tem. A fórmula pode usar a ficha, como mod(CAR), e o equipamento, como
        usando_armadura ou escudo_bonus{entrada.tipo === 'habilidade' ? ', e também nivel_classe e tabela(...)' : ''}.
      </p>
      {entrada.efeitos.map((efeito, indice) => (
        <div key={efeito.id} className="editor-lista-item">
          <div className="editor-lista-campos">
            <label className="campo">
              <span>Muda</span>
              <select value={efeito.alvo} onChange={(e) => trocar(indice, { ...efeito, alvo: e.target.value }, 'alvo')}>
                {!conhecidos.has(efeito.alvo) && <option value={efeito.alvo}>{`(desconhecido: ${efeito.alvo})`}</option>}
                {grupos.map((g) => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.opcoes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <CampoOpcoes
              rotulo="Como"
              valor={efeito.operacao}
              rotulos={ROTULO_OPERACAO}
              aoMudar={(v) => v && trocar(indice, { ...efeito, operacao: v }, 'operacao')}
            />
            <CampoFormula
              rotulo="Valor (fórmula)"
              dica="1 ou mod(CON)"
              valor={efeito.valor}
              conferir={(t) => (t.trim() === '' ? 'Escreva o valor, como 1 ou mod(CON).' : conferir(t))}
              aoMudar={(v) => v.trim() !== '' && trocar(indice, { ...efeito, valor: v }, 'valor')}
            />
            {ehItem && (
              <CampoOpcoes
                rotulo="Quando vale"
                valor={efeito.quando}
                rotulos={ROTULO_QUANDO}
                aoMudar={(v) => v && trocar(indice, { ...efeito, quando: v }, 'quando')}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => mudar(entrada.efeitos.filter((_, i) => i !== indice), `efeito-remover-${efeito.id}`)}
          >
            Remover
          </button>
        </div>
      ))}
      <button
        type="button"
        className="editor-lista-adicionar"
        onClick={() =>
          mudar(
            [...entrada.efeitos, { id: crypto.randomUUID(), alvo: 'ca', operacao: 'somar', valor: '1', quando: ehItem ? 'equipado' : 'sempre' }],
            `efeito-novo-${crypto.randomUUID()}`,
          )
        }
      >
        + Efeito
      </button>
    </fieldset>
  );
}

/** O formulário dos dados próprios de cada tipo de entrada. */
export function FormularioDados({
  entrada,
  mudar,
  todas,
}: {
  readonly entrada: Entrada;
  readonly mudar: (parcial: object, campo: string) => void;
  readonly todas: readonly Entrada[];
}) {
  const props = <T extends TipoEntrada>(e: EntradaDe<T>): PropsFormulario<T> => ({
    dados: e.dados,
    mudar,
    todas,
  });
  switch (entrada.tipo) {
    case 'item':
      return <FormularioItem {...props(entrada)} />;
    case 'magia':
      return <FormularioMagia {...props(entrada)} />;
    case 'habilidade':
      return <FormularioHabilidade {...props(entrada)} />;
    case 'classe':
      return <FormularioClasse {...props(entrada)} />;
    case 'especie':
      return <FormularioEspecie {...props(entrada)} />;
    case 'antecedente':
      return <FormularioAntecedente {...props(entrada)} />;
    case 'talento':
      return <FormularioTalento {...props(entrada)} />;
    case 'condicao':
      return <p className="tela-dica campo-largo">Condições não têm dados próprios: o que elas fazem será definido nos efeitos.</p>;
    case 'monstro':
      return <FormularioMonstro {...props(entrada)} />;
  }
}
