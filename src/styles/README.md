# Identidade visual · Gymnasion v2

Fonte: [Identidade visual no Figma](https://www.figma.com/design/Kw1G5FRZa0zVp2UBwC3kXK/Prototipo---Projeto-de-Software?node-id=409-4876).

`tokens.css` centraliza cores, tipografia, raios e sombras extraídos da identidade visual. É importado globalmente por `index.css`. A fonte variável Montserrat é servida localmente pelo pacote `@fontsource-variable/montserrat`, importado em `main.tsx`.

## Uso nos próximos componentes

Manter cada componente e seu CSS na mesma pasta. Consumir as variáveis globais no CSS, sem repetir os valores hexadecimais:

```css
.example {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
}
```

As classes de `typography.css` são opcionais e não determinam a semântica HTML:

| Classe | Tamanho | Peso | Entrelinha |
| --- | --- | --- | --- |
| `text-display` | 60px | 800 | 1.18 |
| `text-title-1` | 32px | 800 | 1.18 |
| `text-title-2` | 24px | 800 | 1.5 |
| `text-card-title` | 16px | 700 | 1.5 |
| `text-body` | 14px | 400 | 1.5 |
| `text-caption` | 12px | 600 | 1.5 |

Tamanhos usam rem para acompanhar a preferência de fonte do navegador; os valores em px consideram uma raiz de 16px. Os três títulos usam espaçamento entre letras de -0.02em.

Usar `--color-primary-*` para a marca, `--color-success/warning/danger/info` para feedback e `--color-sport-*` para modalidades. A modalidade personalizada recebe a cor escolhida pelo personal, não uma cor fixa inventada.

Raios: controles 10px, cards 16px, modais 20px, badges/avatares 999px. Sombras `--shadow-sm` e `--shadow-lg` correspondem aos exemplos de card e modal do Figma.

O símbolo oficial exportado do Figma está em `public/brand/gymnasion-symbol.svg` e é utilizado como favicon. Preservar sua proporção. A composição do logo e os demais componentes serão implementados na etapa seguinte.

## Migração progressiva

As páginas existentes ainda possuem cores locais do layout antigo. A base global já utiliza a nova identidade, mas a migração de cada página e componente deve substituir esses estilos pelos tokens durante sua implementação. Não confundir essa base com a conclusão do redesign das telas.
