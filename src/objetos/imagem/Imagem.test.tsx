// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { limparAposCadaTeste, montarMesa, novoObjetoDeTeste, objetoDe, projetoDeTeste } from '../../app/testeUtil';

limparAposCadaTeste();

const projetoComImagem = () => projetoDeTeste((p) => { p.objetos.push(novoObjetoDeTeste('imagem', 'img1')); });
const entrada = () => screen.getByLabelText('Escolher imagem', { selector: 'input' });

describe('Imagem', () => {
  it('mostra aviso quando ainda não há imagem', () => {
    montarMesa(projetoComImagem());
    expect(screen.getByText(/Nenhuma imagem ainda/)).toBeInTheDocument();
  });

  it('importa arquivo como data URL no estado e ajusta ao quadro', async () => {
    const { armazem } = montarMesa(projetoComImagem());
    const arquivo = new File([new Uint8Array([137, 80, 78, 71])], 'foto.png', { type: 'image/png' });
    await userEvent.upload(entrada(), arquivo);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Imagem: foto.png' })).toBeInTheDocument());
    const estado = objetoDe(armazem.getState().projeto, 'img1').estado as { dataUrl: string; nome: string };
    expect(estado.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(estado.nome).toBe('foto.png');
    const img = screen.getByRole('img', { name: 'Imagem: foto.png' });
    expect(img.style.objectFit).toBe('contain');
    await userEvent.click(screen.getByRole('button', { name: 'Preencher o quadro' }));
    expect(screen.getByRole('img', { name: 'Imagem: foto.png' }).style.objectFit).toBe('cover');
  });

  it('recusa arquivo que não é imagem, com mensagem em português', async () => {
    const { armazem } = montarMesa(projetoComImagem());
    // applyAccept desligado para simular quem escolhe "todos os arquivos"
    const usuario = userEvent.setup({ applyAccept: false });
    await usuario.upload(entrada(), new File(['oi'], 'nota.txt', { type: 'text/plain' }));
    expect(screen.getByText(/não é uma imagem/)).toBeInTheDocument();
    expect(objetoDe(armazem.getState().projeto, 'img1').estado).toEqual({});
  });
});
