import type { MouseEvent } from 'react';
import type { ModoDoTeste, ResultadoDaAcao } from '../core/acoesDaFicha';
import type { Calculado, Calculo } from '../core/calculadora';
import type { ItemDoMenu } from './MenuDeContexto';

/** O que os blocos da ficha podem fazer na mesa: rolar, abrir menus, executar ações e presentear. */
export interface Mesa {
  readonly calculo: Calculo;
  /** Rola um teste de d20 somando `termo`, como `atletismo` ou `mod(FOR)`. */
  rolar(termo: string, rotulo: string, modo?: ModoDoTeste): void;
  /** Abre o menu do botão direito onde o mouse está. */
  menu(evento: MouseEvent, titulo: string, itens: readonly ItemDoMenu[]): void;
  /** Aplica o resultado de uma ação: muda a ficha, registra as rolagens ou mostra o erro. */
  fazer(resultado: ResultadoDaAcao): void;
  /** Abre a janela para passar uma pilha a outra ficha. */
  presentear(pilhaId: string): void;
  /** Há outras fichas para receber presentes. */
  readonly temOutrasFichas: boolean;
  /** Abre a explicação do número perto do elemento clicado. */
  explicar(alvo: HTMLElement, rotulo: string, calculado: Calculado, nota?: string): void;
  /** Quem está agindo pode rolar, usar e arrumar esta ficha (é o dono ou o mestre). */
  readonly podeAgir: boolean;
  /** Pode mudar tudo: atributos, classes, itens novos, cópias (o mestre, ou o dono com a edição liberada). */
  readonly podeEditarTudo: boolean;
  /** Por que algo está desativado, para a dica do controle. */
  readonly motivo: string | null;
}
