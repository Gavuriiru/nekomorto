export type DownloadSource = {
  label: string;
  url: string;
};

export type ProjectEpisode = {
  number: number;
  volume?: number;
  title: string;
  synopsis: string;
  releaseDate: string;
  duration: string;
  coverImageUrl?: string;
  sourceType: "TV" | "Web" | "Blu-ray";
  sources: DownloadSource[];
  hash?: string;
  sizeBytes?: number;
  progressStage?: string;
  completedStages?: string[];
  content?: string;
  contentFormat?: "lexical";
  chapterUpdatedAt?: string;
};

export type ProjectStaff = {
  role: string;
  members: string[];
};

export type ProjectRelation = {
  relation: string;
  title: string;
  format: string;
  status: string;
  image: string;
  anilistId?: number;
  projectId?: string;
};

export type Project = {
  id: string;
  anilistId?: number | null;
  title: string;
  titleOriginal?: string;
  titleEnglish?: string;
  synopsis: string;
  description: string;
  type: string;
  status: string;
  year: string;
  studio: string;
  episodes: string;
  tags: string[];
  genres?: string[];
  cover: string;
  banner: string;
  season: string;
  schedule: string;
  rating: string;
  country?: string;
  source?: string;
  producers?: string[];
  score?: number | null;
  startDate?: string;
  endDate?: string;
  views?: number;
  viewsDaily?: Record<string, number>;
  commentsCount?: number;
  updatedAt?: string;
  episodeDownloads: ProjectEpisode[];
  staff: ProjectStaff[];
  animeStaff?: ProjectStaff[];
  relations?: ProjectRelation[];
  trailerUrl?: string;
  forceHero?: boolean;
  heroImageUrl?: string;
};

const defaultSources: DownloadSource[] = [
  { label: "Google Drive", url: "#" },
  { label: "MEGA", url: "#" },
  { label: "Torrent", url: "#" },
];

const defaultStaff: ProjectStaff[] = [
  { role: "Tradução", members: ["Hana Morita", "Lucas Sato"] },
  { role: "Timing", members: ["Kai Nakamura"] },
  { role: "Revisão", members: ["Maya Fujimoto", "Renata Aoki"] },
  { role: "Encode", members: ["Studio Rainbow"] },
];

const buildEpisodeDownloads = ({
  count,
  startDate,
  titlePrefix,
  duration = "24 min",
  sourceType = "TV",
}: {
  count: number;
  startDate: string;
  titlePrefix: string;
  duration?: string;
  sourceType?: "TV" | "Web" | "Blu-ray";
}): ProjectEpisode[] => {
  if (count <= 0) {
    return [];
  }

  const baseDate = new Date(startDate);

  return Array.from({ length: count }, (_, index) => {
    const releaseDate = new Date(baseDate);
    releaseDate.setDate(baseDate.getDate() + index * 7);

    return {
      number: index + 1,
      title: `${titlePrefix} ${index + 1}`,
      synopsis:
        "Nesta parte, os personagens encaram um novo desafio e revelam detalhes importantes para a trama.",
      releaseDate: releaseDate.toISOString().split("T")[0],
      duration,
      sourceType,
      sources: defaultSources,
    };
  });
};

export const projectData: Project[] = [
  {
    id: "aurora-no-horizonte",
    title: "Aurora no Horizonte",
    synopsis: "Uma jornada sci-fi sobre amizade, esperança e o renascimento de uma nave perdida.",
    description:
      "Após um acidente misterioso, uma tripulação desperta em uma nave desgovernada. Entre mistérios cósmicos e laços de amizade, a missão agora é encontrar um novo horizonte para todos.",
    type: "Anime",
    status: "Em andamento",
    year: "2024",
    studio: "Studio Polaris",
    episodes: "12 episódios",
    tags: ["Sci-fi", "Drama", "Aventura"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Temporada 1",
    schedule: "Sábados, 18h",
    rating: "Livre",
    episodeDownloads: buildEpisodeDownloads({
      count: 6,
      startDate: "2024-01-13",
      titlePrefix: "O despertar da aurora",
      sourceType: "TV",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
    relations: [
      {
        relation: "Prequela",
        title: "Aurora no Horizonte: Origem",
        format: "OVA",
        status: "Finalizado",
        image: "/placeholder.svg",
      },
      {
        relation: "Sequência",
        title: "Aurora no Horizonte: Reencontro",
        format: "Anime",
        status: "Em produção",
        image: "/placeholder.svg",
      },
    ],
  },
  {
    id: "nekomata-eclipse",
    title: "Nekomata: Eclipse",
    synopsis: "Mangá sobrenatural que acompanha um clã felino e seus pactos com o submundo.",
    description:
      "Em uma cidade onde espíritos se misturam ao cotidiano, um clã felino protege acordos antigos. Cada capítulo revela os segredos do eclipse que ameaça quebrar o pacto.",
    type: "Mangá",
    status: "Completo",
    year: "2023",
    studio: "Kitsune Press",
    episodes: "38 capítulos",
    tags: ["Sobrenatural", "Ação", "Mistério"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Volume único",
    schedule: "Completo",
    rating: "14 anos",
    episodeDownloads: buildEpisodeDownloads({
      count: 5,
      startDate: "2023-05-01",
      titlePrefix: "Capítulo",
      duration: "Leitura",
      sourceType: "Web",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "rainbow-pulse",
    title: "Rainbow Pulse",
    synopsis: "Idols futuristas lutam para manter a música viva em uma metrópole distópica.",
    description:
      "Em uma cidade dominada por corporações, um grupo de idols usa a música para inspirar resistência. Cada episódio vibra com performances intensas e narrativas emocionantes.",
    type: "Anime",
    status: "Em andamento",
    year: "2024",
    studio: "Sakura Wave",
    episodes: "24 episódios",
    tags: ["Música", "Ficção", "Ação"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Temporada 2",
    schedule: "Quartas, 20h",
    rating: "12 anos",
    episodeDownloads: buildEpisodeDownloads({
      count: 8,
      startDate: "2024-01-03",
      titlePrefix: "Pulso",
      sourceType: "TV",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "boreal-nocturne",
    title: "Boreal Nocturne",
    synopsis: "Um especial musical sobre um festival mágico de inverno e seus mistérios.",
    description:
      "Um especial de inverno que acompanha uma noite mágica sob as luzes boreais. Entre música e encantos, um segredo ancestral vem à tona.",
    type: "Especial",
    status: "Lançado",
    year: "2022",
    studio: "Lumière",
    episodes: "1 especial",
    tags: ["Fantasia", "Música", "Slice of Life"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Especial único",
    schedule: "Disponível",
    rating: "Livre",
    episodeDownloads: buildEpisodeDownloads({
      count: 1,
      startDate: "2022-12-20",
      titlePrefix: "Noite Boreal",
      duration: "48 min",
      sourceType: "Blu-ray",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "estacoes-em-orbita",
    title: "Estações em Órbita",
    synopsis: "Filme romântico que acompanha encontros improváveis em uma estação espacial.",
    description:
      "Em uma estação espacial, duas vidas se cruzam em meio a rotinas silenciosas. O filme mistura contemplação e romance em um cenário futurista.",
    type: "Filme",
    status: "Lançado",
    year: "2023",
    studio: "Orbit Works",
    episodes: "1 filme",
    tags: ["Romance", "Sci-fi", "Drama"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Filme",
    schedule: "Disponível",
    rating: "12 anos",
    episodeDownloads: buildEpisodeDownloads({
      count: 1,
      startDate: "2023-08-10",
      titlePrefix: "Filme completo",
      duration: "1h 45m",
      sourceType: "Blu-ray",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "fragmentos-de-verao",
    title: "Fragmentos de Verão",
    synopsis: "OVA delicado sobre amizades e segredos em uma cidade litorânea.",
    description:
      "Em uma pequena cidade à beira-mar, memórias de verão se misturam a segredos guardados por amigos de infância. Um OVA sensível e nostálgico.",
    type: "OVA",
    status: "Lançado",
    year: "2021",
    studio: "Blue Tide",
    episodes: "2 OVAs",
    tags: ["Drama", "Slice of Life", "Romance"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "OVA",
    schedule: "Disponível",
    rating: "12 anos",
    episodeDownloads: buildEpisodeDownloads({
      count: 2,
      startDate: "2021-02-12",
      titlePrefix: "Fragmento",
      duration: "32 min",
      sourceType: "Blu-ray",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "galaxia-ona",
    title: "Galáxia ONA",
    synopsis: "ONA de aventura espacial com humor e uma tripulação inesperada.",
    description:
      "Uma tripulação improvável explora planetas inóspitos em missões cheias de humor. A série equilibra aventura e carisma.",
    type: "ONA",
    status: "Em andamento",
    year: "2024",
    studio: "Nebula Lab",
    episodes: "8 episódios",
    tags: ["Aventura", "Comédia", "Sci-fi"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Temporada 1",
    schedule: "Domingos, 21h",
    rating: "10 anos",
    episodeDownloads: buildEpisodeDownloads({
      count: 4,
      startDate: "2024-01-07",
      titlePrefix: "Salto",
      sourceType: "Web",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "harmonia-sakura",
    title: "Harmonia Sakura",
    synopsis: "Webtoon sobre uma academia de artes onde rivalidade vira amizade.",
    description:
      "Entre ensaios e apresentações, rivalidades se transformam em parcerias criativas. Um webtoon colorido sobre amizade e música.",
    type: "Webtoon",
    status: "Em andamento",
    year: "2024",
    studio: "Hanami Studio",
    episodes: "45 capítulos",
    tags: ["Escolar", "Drama", "Música"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Temporada 1",
    schedule: "Quintas, 19h",
    rating: "Livre",
    episodeDownloads: buildEpisodeDownloads({
      count: 5,
      startDate: "2024-01-04",
      titlePrefix: "Capítulo",
      duration: "Leitura",
      sourceType: "Web",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "iris-black",
    title: "Iris Black",
    synopsis: "Thriller urbano com detetives psíquicos em uma cidade neon.",
    description:
      "Dois detetives psíquicos investigam crimes impossíveis em uma cidade neon. A série mistura suspense, ação e uma estética cyberpunk marcante.",
    type: "Anime",
    status: "Em produção",
    year: "2025",
    studio: "Noir Edge",
    episodes: "Anunciado",
    tags: ["Suspense", "Ação", "Cyberpunk"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Temporada 1",
    schedule: "Em breve",
    rating: "16 anos",
    episodeDownloads: [],
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "jardim-das-marés",
    title: "Jardim das Marés",
    synopsis: "Mangá poético sobre guardiões que protegem aldeias costeiras.",
    description:
      "Guardians ancestrais cuidam do equilíbrio entre mar e terra. Um mangá poético com foco em vínculos familiares e espiritualidade.",
    type: "Mangá",
    status: "Em andamento",
    year: "2022",
    studio: "Horizon Ink",
    episodes: "27 capítulos",
    tags: ["Fantasia", "Aventura", "Drama"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Volume 2",
    schedule: "Mensal",
    rating: "Livre",
    episodeDownloads: buildEpisodeDownloads({
      count: 6,
      startDate: "2022-03-10",
      titlePrefix: "Capítulo",
      duration: "Leitura",
      sourceType: "Web",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "lumina-kizuna",
    title: "Lumina Kizuna",
    synopsis: "Especial animado sobre uma ligação luminosa entre duas irmãs mágicas.",
    description:
      "Duas irmãs mágicas descobrem uma conexão brilhante que muda seus destinos. Um especial emotivo sobre família e coragem.",
    type: "Especial",
    status: "Lançado",
    year: "2020",
    studio: "Aurora Bloom",
    episodes: "1 especial",
    tags: ["Fantasia", "Família", "Slice of Life"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Especial único",
    schedule: "Disponível",
    rating: "Livre",
    episodeDownloads: buildEpisodeDownloads({
      count: 1,
      startDate: "2020-09-14",
      titlePrefix: "Especial",
      duration: "52 min",
      sourceType: "Blu-ray",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "memento-arc",
    title: "Memento Arc",
    synopsis: "Filme de fantasia sobre memórias perdidas e viagens temporais.",
    description:
      "Uma jornada de fantasia que explora memórias perdidas e escolhas que mudam o tempo. Um filme repleto de emoção e mistério.",
    type: "Filme",
    status: "Lançado",
    year: "2021",
    studio: "Chronos Lab",
    episodes: "1 filme",
    tags: ["Fantasia", "Drama", "Mistério"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Filme",
    schedule: "Disponível",
    rating: "12 anos",
    episodeDownloads: buildEpisodeDownloads({
      count: 1,
      startDate: "2021-11-02",
      titlePrefix: "Filme completo",
      duration: "2h 02m",
      sourceType: "Blu-ray",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "nova-primavera",
    title: "Nova Primavera",
    synopsis: "Ova musical que celebra uma nova geração de idols.",
    description:
      "Um OVA vibrante que acompanha a estreia de novas idols em um show decisivo. Música e emoção em doses perfeitas.",
    type: "OVA",
    status: "Lançado",
    year: "2022",
    studio: "Idol Forge",
    episodes: "3 OVAs",
    tags: ["Música", "Slice of Life", "Comédia"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "OVA",
    schedule: "Disponível",
    rating: "Livre",
    episodeDownloads: buildEpisodeDownloads({
      count: 3,
      startDate: "2022-04-18",
      titlePrefix: "Primavera",
      duration: "28 min",
      sourceType: "Blu-ray",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "oraculo-de-cristal",
    title: "Oráculo de Cristal",
    synopsis: "ONA de fantasia com guerreiros que usam cristais para salvar reinos.",
    description:
      "Guerreiros despertam cristais ancestrais para proteger seus reinos. Uma ONA cheia de ação e magia.",
    type: "ONA",
    status: "Em andamento",
    year: "2023",
    studio: "Crystal Spine",
    episodes: "10 episódios",
    tags: ["Fantasia", "Ação", "Aventura"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Temporada 1",
    schedule: "Segundas, 20h",
    rating: "12 anos",
    episodeDownloads: buildEpisodeDownloads({
      count: 5,
      startDate: "2023-09-04",
      titlePrefix: "Crônica",
      sourceType: "Web",
    }),
    staff: defaultStaff,
    trailerUrl: "#",
  },
  {
    id: "prisma-ryu",
    title: "Prisma Ryu",
    synopsis: "Spin-off que acompanha uma nova heroína em um universo mágico.",
    description:
      "Uma nova heroína assume o protagonismo em um spin-off cheio de magia e lutas coreografadas. O projeto está em pré-produção.",
    type: "Spin-off",
    status: "Em produção",
    year: "2025",
    studio: "Rainbow Works",
    episodes: "Anunciado",
    tags: ["Fantasia", "Ação", "Shojo"],
    cover: "/placeholder.svg",
    banner: "/placeholder.svg",
    season: "Spin-off",
    schedule: "Em breve",
    rating: "12 anos",
    episodeDownloads: [],
    staff: defaultStaff,
    trailerUrl: "#",
  },
];
