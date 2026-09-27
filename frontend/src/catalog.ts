export interface Title {
  id: string;
  kind: "MOVIE" | "SERIES";
  name: string;
  year: number;
  maturity: string;
  duration: string;
  match: number;
  genres: string[];
  synopsis: string;
  art: string;
  thumbnail?: string;
}

export interface Shelf {
  id: string;
  title: string;
  items: Title[];
}

export const featured: Title = {
  id: "m_7721",
  kind: "MOVIE",
  name: "Ecos do Abismo",
  year: 2026,
  maturity: "16",
  duration: "2h 08min",
  match: 98,
  genres: ["Ficcao cientifica", "Suspense", "Drama"],
  synopsis: "Quando o oceano recua sem explicacao, uma cartografa encontra uma cidade que nao deveria existir — e uma mensagem enviada pelo seu proprio futuro.",
  art: "hero"
};

const titles: Title[] = [
  { id: "m_101", kind: "MOVIE", name: "A Ultima Frequencia", year: 2025, maturity: "14", duration: "1h 54min", match: 97, genres: ["Misterio", "Drama"], synopsis: "Uma radialista capta uma transmissao que antecipa acontecimentos da cidade.", art: "signal" },
  { id: "m_102", kind: "SERIES", name: "Distrito Rubro", year: 2026, maturity: "16", duration: "8 episodios", match: 96, genres: ["Crime", "Suspense"], synopsis: "Uma investigadora atravessa a noite mais longa da capital para expor uma conspiracao.", art: "district" },
  { id: "m_103", kind: "MOVIE", name: "O Peso da Noite", year: 2024, maturity: "14", duration: "2h 12min", match: 94, genres: ["Drama", "Thriller"], synopsis: "Segredos de uma familia emergem durante uma tempestade que isola a cidade.", art: "night" },
  { id: "m_104", kind: "MOVIE", name: "Horizonte Zero", year: 2026, maturity: "12", duration: "1h 48min", match: 93, genres: ["Aventura", "Ficcao"], synopsis: "Uma expedicao parte para alem do ultimo ponto registrado nos mapas.", art: "horizon" },
  { id: "m_105", kind: "SERIES", name: "Arquivo 27", year: 2025, maturity: "16", duration: "6 episodios", match: 91, genres: ["Investigacao", "Misterio"], synopsis: "Um arquivo apagado conecta crimes separados por tres decadas.", art: "archive" },
  { id: "m_106", kind: "MOVIE", name: "Cinzas de Verao", year: 2024, maturity: "14", duration: "1h 46min", match: 89, genres: ["Drama", "Romance"], synopsis: "Dois antigos amigos se reencontram na cidade que juraram deixar para tras.", art: "ashes" },
  { id: "m_107", kind: "MOVIE", name: "Linha de Fuga", year: 2026, maturity: "16", duration: "2h 01min", match: 95, genres: ["Acao", "Crime"], synopsis: "Uma motorista de fuga tem uma noite para quitar uma divida impossivel.", art: "escape" },
  { id: "m_108", kind: "MOVIE", name: "Depois do Silencio", year: 2025, maturity: "12", duration: "1h 57min", match: 92, genres: ["Drama", "Musica"], synopsis: "Um maestro recluso encontra uma nova forma de ouvir o mundo.", art: "silence" }
];

export const shelves: Shelf[] = [
  { id: "trending", title: "Em alta agora", items: titles.slice(0, 6) },
  { id: "continue", title: "Continue assistindo", items: [titles[6]!, titles[2]!, titles[7]!, titles[4]!, titles[0]!] },
  { id: "noir", title: "Noites, segredos e neon", items: [titles[1]!, titles[4]!, titles[0]!, titles[6]!, titles[2]!, titles[5]!] }
];
