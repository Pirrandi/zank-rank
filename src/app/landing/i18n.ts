// Diccionario bilingüe de la landing pública (/). Sin librería de i18n: es una sola página,
// así que un objeto tipado alcanza y deja bien claro si falta traducir algo (TS se queja si
// falta una clave en cualquiera de los dos idiomas, porque `dict.es` y `dict.en` comparten tipo).
export type Lang = "es" | "en";

export type PlanFeatureCopy = { glyph: "✓" | "~" | "·"; text: string };

type LandingDict = {
  header: {
    sectionsAria: string;
    navFeatures: string;
    navHow: string;
    navPlans: string;
    github: string;
    langSwitchAria: string;
  };
  hero: {
    badge: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    viewerLink: string;
    ossLink: string;
  };
  leaderboardDemo: {
    toastLabel: string;
    toastText: string;
    boardTitle: string;
    live: string;
    inGameAria: string;
  };
  tiers: {
    BRONZE: string;
    SILVER: string;
    GOLD: string;
    PLATINUM: string;
    EMERALD: string;
  };
  features: {
    sectionTitle: string;
    sectionLead: string;
    sync: { label: string; title: string; body: string; chartTop: string; chartBottom: string };
    live: { label: string; title: string; body: string };
    versus: { label: string; title: string; body: string };
    walls: {
      label: string;
      title: string;
      body: string;
      fameLabel: string;
      fameText: string;
      shameLabel: string;
      shameText: string;
    };
    bot: {
      label: string;
      title: string;
      body: string;
      queueLabel: string;
      queueValue: string;
      championLabel: string;
      championValue: string;
      rankLabel: string;
      rankValue: string;
    };
  };
  roasts: string[];
  matchTimer: { inGame: string };
  steps: {
    title: string;
    items: { title: string; body: string }[];
  };
  plans: {
    sectionTitle: string;
    sectionLead: string;
    web: {
      badge: string;
      title: string;
      desc: string;
      features: PlanFeatureCopy[];
      noteLabel: string;
      noteText: string;
    };
    selfHosted: {
      badge: string;
      title: string;
      desc: string;
      features: PlanFeatureCopy[];
      githubCta: string;
    };
    copyIdle: string;
    copyDone: string;
  };
  finalCta: { title: string };
  cta: { panel: string; login: string; viewer: string };
};

export const dict: Record<Lang, LandingDict> = {
  es: {
    header: {
      sectionsAria: "Secciones",
      navFeatures: "Qué hace",
      navHow: "Cómo funciona",
      navPlans: "Web o self-hosted",
      github: "GitHub",
      langSwitchAria: "Idioma",
    },
    hero: {
      badge: "Ranking privado de League of Legends",
      titleLine1: "Tu grupo.",
      titleLine2: "Tu ranking.",
      lead: "Arma una liga con tus amigos. Rango, LP y rachas se sincronizan solos desde Riot, y un bot en Discord se encarga de festejar cada subida… y de exponer cada caída.",
      viewerLink: "¿Quieres ver un preview en vivo? Este es nuestro ranking →",
      ossLink: "Open source · self-hostéalo",
    },
    leaderboardDemo: {
      toastLabel: "SUBIÓ DE RANGO",
      toastText: "Pirrandi → Platino IV",
      boardTitle: "Ranking · Los del asado",
      live: "EN VIVO",
      inGameAria: "En partida",
    },
    tiers: {
      BRONZE: "Bronce",
      SILVER: "Plata",
      GOLD: "Oro",
      PLATINUM: "Platino",
      EMERALD: "Esmeralda",
    },
    features: {
      sectionTitle: "Todo lo que tu grupo de Discord necesitaba para pelearse mejor.",
      sectionLead: "Tú agregas los invocadores. Del resto se encarga zank.",
      sync: {
        label: "Sync con Riot",
        title: "Rango, LP y rachas, solos",
        body: "Cada 15 minutos consulta la API de Riot. Historial de LP para ver quién viene subiendo y quién está en caída libre.",
        chartTop: "Oro I",
        chartBottom: "Platino IV · +126 LP",
      },
      live: {
        label: "En vivo + apuestas",
        title: "Mira quién está jugando y apuesta",
        body: "¿Gana o pierde? Apuesta ZankCoins y cobra x2 si aciertas. Solo por el honor.",
      },
      versus: {
        label: "Versus",
        title: "Las personalizadas quedan grabadas",
        body: "Detecta cuando dos del grupo caen en equipos rivales. El historial no perdona.",
      },
      walls: {
        label: "Muros",
        title: "Fama y vergüenza, automáticas",
        body: "Pentakills, robos de Barón, rachas de derrotas y KDAs para el recuerdo. Con reacciones.",
        fameLabel: "FAMA",
        fameText: "Pentakill · Ahri",
        shameLabel: "VERGÜENZA",
        shameText: "17 muertes · Jinx",
      },
      bot: {
        label: "Bot de Discord + IA",
        title: "Roasts que se escriben solos",
        body: "Avisa cada subida y bajada en tu servidor, con un comentario generado por IA. Y todos los días a las 12:00, una nota de la S a la F para cada jugador.",
        queueLabel: "Cola",
        queueValue: "Solo/Dúo",
        championLabel: "Campeón",
        championValue: "Zed",
        rankLabel: "Rango",
        rankValue: "Plata II • 40 LP",
      },
    },
    roasts: [
      "NoFlash4U bajó a Plata II. El nick era una advertencia.",
      "smOKe llegó a Platino I. Alguien revise que no le haya jugado el primo.",
      "Cinco derrotas seguidas. A esta altura el LP le pide perdón a él.",
      "ChuchoMid hizo pentakill y ya lo mandó al grupo tres veces.",
    ],
    matchTimer: { inGame: "EN PARTIDA" },
    steps: {
      title: "Listo en tres pasos",
      items: [
        { title: "Entra con Discord", body: "Se crea tu workspace en un click. Sin contraseñas nuevas." },
        { title: "Agrega a tus amigos", body: "Nombre#TAG de cada invocador. zank trae el rango y el historial." },
        { title: "Suma el bot", body: "Invítalo a tu servidor y elige dónde avisa. Que empiece el roast." },
      ],
    },
    plans: {
      sectionTitle: "Úsalo aquí o móntalo tú",
      sectionLead:
        "zank es open source. La versión web es la forma rápida; self-hosted es para el que quiere todo sin techo.",
      web: {
        badge: "RECOMENDADO",
        title: "Versión web",
        desc: "Entras con Discord y en dos minutos tienes tu ranking. Gratis y con todas las funciones, con algunos límites para que la API alcance para todos.",
        features: [
          { glyph: "✓", text: "Listo en 2 minutos, sin servidor" },
          { glyph: "✓", text: "Bot de Discord compartido incluido" },
          { glyph: "✓", text: "Todas las funciones: muros, versus, apuestas, IA" },
          { glyph: "~", text: "Máximo 2 rankings y 15 invocadores" },
          { glyph: "~", text: "Sync cada 15 minutos" },
          { glyph: "~", text: "Análisis IA limitado" },
        ],
        noteLabel: "¿Por qué?",
        noteText:
          "Riot nos da una cantidad fija de consultas a su API para toda la versión web. Con estos límites alcanza para que todos los rankings se actualicen rápido. Si necesitas más, self-hostéalo con tu propia key.",
      },
      selfHosted: {
        badge: "CÓDIGO ABIERTO",
        title: "Autoalojado",
        desc: "Clona el repo, pon tu Riot API key y tu bot, y levántalo con Docker en un comando. Sin límites, todo tuyo.",
        features: [
          { glyph: "✓", text: "Invocadores ilimitados" },
          { glyph: "✓", text: "Sync tan seguido como aguante tu key" },
          { glyph: "✓", text: "Tu propio bot, tu propio prompt de IA" },
          { glyph: "✓", text: "Tus datos en tu base" },
          { glyph: "·", text: "Solo necesitas Docker y tu Riot API key" },
        ],
        githubCta: "Ver en GitHub",
      },
      copyIdle: "Copiar",
      copyDone: "Copiado ✓",
    },
    finalCta: { title: "¿Quién es el peor de tu grupo? Ya lo vas a saber." },
    cta: { panel: "Ir a mi panel", login: "Entrar con Discord", viewer: "Ver el ranking" },
  },
  en: {
    header: {
      sectionsAria: "Sections",
      navFeatures: "What it does",
      navHow: "How it works",
      navPlans: "Cloud or self-hosted",
      github: "GitHub",
      langSwitchAria: "Language",
    },
    hero: {
      badge: "Private League of Legends leaderboard",
      titleLine1: "Your squad.",
      titleLine2: "Your ranking.",
      lead: "Build a league with your friends. Rank, LP, and streaks sync straight from Riot, and a Discord bot handles celebrating every climb… and exposing every fall.",
      viewerLink: "Want a live preview? Here's our own ranking →",
      ossLink: "Open source · self-host it",
    },
    leaderboardDemo: {
      toastLabel: "RANK UP",
      toastText: "Pirrandi → Platinum IV",
      boardTitle: "Ranking · The BBQ Squad",
      live: "LIVE",
      inGameAria: "In game",
    },
    tiers: {
      BRONZE: "Bronze",
      SILVER: "Silver",
      GOLD: "Gold",
      PLATINUM: "Platinum",
      EMERALD: "Emerald",
    },
    features: {
      sectionTitle: "Everything your Discord group needed to fight better.",
      sectionLead: "You add the summoners. Zank handles the rest.",
      sync: {
        label: "Riot sync",
        title: "Rank, LP, and streaks — on autopilot",
        body: "It hits Riot's API every 15 minutes. Full LP history so you can see who's climbing and who's in free fall.",
        chartTop: "Gold I",
        chartBottom: "Platinum IV · +126 LP",
      },
      live: {
        label: "Live + bets",
        title: "Watch who's in-game and bet on it",
        body: "Win or lose? Bet ZankCoins and cash in 2x if you call it right. Purely for the bragging rights.",
      },
      versus: {
        label: "Versus",
        title: "Every custom game, on the record",
        body: "Catches it whenever two of you land on rival teams. The history doesn't forgive.",
      },
      walls: {
        label: "Walls",
        title: "Fame and shame, automatic",
        body: "Pentakills, stolen Barons, losing streaks, and KDAs for the history books. With reactions.",
        fameLabel: "FAME",
        fameText: "Pentakill · Ahri",
        shameLabel: "SHAME",
        shameText: "17 deaths · Jinx",
      },
      bot: {
        label: "Discord bot + AI",
        title: "Roasts that write themselves",
        body: "It announces every rank change in your server, with an AI-generated comment. And every day at noon, an S-to-F grade for each player.",
        queueLabel: "Queue",
        queueValue: "Solo/Duo",
        championLabel: "Champion",
        championValue: "Zed",
        rankLabel: "Rank",
        rankValue: "Silver II • 40 LP",
      },
    },
    roasts: [
      "NoFlash4U dropped to Silver II. The name was a warning.",
      "smOKe just hit Platinum I. Someone check his cousin wasn't playing for him.",
      "Five losses in a row. At this point the LP owes him an apology.",
      "ChuchoMid got a pentakill and already sent it to the group chat three times.",
    ],
    matchTimer: { inGame: "IN GAME" },
    steps: {
      title: "Live in three steps",
      items: [
        { title: "Sign in with Discord", body: "Your workspace spins up in one click. No new passwords." },
        { title: "Add your friends", body: "Name#TAG for each summoner. Zank pulls the rank and history." },
        { title: "Add the bot", body: "Invite it to your server and pick where it posts. Let the roasting begin." },
      ],
    },
    plans: {
      sectionTitle: "Use it here, or run it yourself",
      sectionLead:
        "zank is open source. The cloud version is the fast way in; self-hosted is for anyone who wants no ceiling at all.",
      web: {
        badge: "RECOMMENDED",
        title: "Cloud version",
        desc: "Sign in with Discord and your ranking is live in two minutes. Free, with every feature, with a few limits so the API stretches for everyone.",
        features: [
          { glyph: "✓", text: "Live in 2 minutes, no server needed" },
          { glyph: "✓", text: "Shared Discord bot included" },
          { glyph: "✓", text: "Every feature: walls, versus, bets, AI" },
          { glyph: "~", text: "Up to 2 rankings and 15 summoners" },
          { glyph: "~", text: "Syncs every 15 minutes" },
          { glyph: "~", text: "Limited AI analysis" },
        ],
        noteLabel: "Why?",
        noteText:
          "Riot gives us a fixed quota of API calls for the entire cloud version. These limits keep every ranking updating fast for everyone. Need more? Self-host it with your own key.",
      },
      selfHosted: {
        badge: "OPEN SOURCE",
        title: "Self-hosted",
        desc: "Clone the repo, drop in your Riot API key and bot, and spin it up with Docker in one command. No limits, all yours.",
        features: [
          { glyph: "✓", text: "Unlimited summoners" },
          { glyph: "✓", text: "Sync as often as your key can take" },
          { glyph: "✓", text: "Your own bot, your own AI prompt" },
          { glyph: "✓", text: "Your data, your database" },
          { glyph: "·", text: "All you need is Docker and your Riot API key" },
        ],
        githubCta: "View on GitHub",
      },
      copyIdle: "Copy",
      copyDone: "Copied ✓",
    },
    finalCta: { title: "Who's the worst in your group? You're about to find out." },
    cta: { panel: "Go to my dashboard", login: "Sign in with Discord", viewer: "View the ranking" },
  },
};
