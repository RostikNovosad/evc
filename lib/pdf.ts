import type { Content, TableCell } from 'pdfmake/interfaces';
import type { Card } from './schema';

const MUTED = '#5d7a80';

function formatDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function row(card: Card): TableCell[] {
  const tags = [card.type, card.partOfSpeech, card.register].filter(Boolean).join(' · ');

  const word: Content[] = [{ text: card.headword, bold: true, fontSize: 13 }];
  if (card.ipa) word.push({ text: card.ipa, color: MUTED, fontSize: 9 });
  word.push({ text: tags, color: MUTED, fontSize: 8, margin: [0, 2, 0, 0] });
  if (card.relatedPhrases?.length) {
    word.push({ text: card.relatedPhrases.join(', '), color: '#5b4b00', fontSize: 9, italics: true, margin: [0, 6, 0, 0] });
  }

  const meaning: Content[] = [
    { text: card.definitionEn },
    { text: card.explanationUk, color: MUTED, margin: [0, 4, 0, 0] },
  ];
  if (card.synonyms?.length) {
    meaning.push({
      text: [{ text: 'Синоніми: ', bold: true }, { text: card.synonyms.join(', '), bold: true, color: '#2c3fb3' }],
      margin: [0, 6, 0, 0],
    });
  }

  const examples: Content[] = card.examples.map((e) => ({
    margin: [0, 0, 0, 4],
    stack: [{ text: e.en }, { text: e.uk, color: MUTED, fontSize: 8.5 }],
  }));

  return [
    { stack: word },
    { text: card.translationUk, bold: true },
    { stack: meaning },
    { stack: examples },
  ];
}

const FONT_FILES = ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf', 'NotoSans-Italic.ttf'];

async function toBase64(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export async function generatePdf(cards: Card[]) {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default;
  const vfs: Record<string, string> = {};
  await Promise.all(
    FONT_FILES.map(async (f) => {
      vfs[f] = await toBase64(await fetch(`/fonts/${f}`));
    }),
  );
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.addFonts({
    NotoSans: {
      normal: 'NotoSans-Regular.ttf',
      bold: 'NotoSans-Bold.ttf',
      italics: 'NotoSans-Italic.ttf',
      bolditalics: 'NotoSans-Bold.ttf',
    },
  });

  const now = new Date();
  const date = formatDate(now);
  const head = ['Слово', 'Переклад', 'Значення та нюанси', 'Приклади'].map((text) => ({
    text, bold: true, fontSize: 8.5, color: MUTED,
  }));

  pdfMake
    .createPdf({
      pageOrientation: 'landscape',
      pageMargins: [36, 60, 36, 36],
      defaultStyle: { font: 'NotoSans', fontSize: 9.5, lineHeight: 1.2 },
      header: { text: `Словник - ${date}`, fontSize: 14, bold: true, margin: [36, 24, 36, 0] },
      content: [
        {
          table: {
            headerRows: 1,
            widths: [110, 100, '*', '*'],
            body: [head, ...cards.map(row)],
          },
          layout: {
            hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
            vLineWidth: () => 0,
            hLineColor: () => '#c9dcd8',
            paddingTop: () => 8,
            paddingBottom: () => 8,
          },
        },
      ],
    })
    .download(`slovnyk-${now.toISOString().slice(0, 10)}.pdf`);
}
