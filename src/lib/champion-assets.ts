// Static Data Dragon URLs for a champion's internal name (MatchParticipation.championName, as
// returned by match-v5). No network lookup: the redesign pins the icon CDN version, and the
// splash path is unversioned.

const ICON_VERSION = "14.24.1";

// match-v5 and Data Dragon disagree on a few internal ids.
const DDRAGON_ID_OVERRIDES: Record<string, string> = {
  FiddleSticks: "Fiddlesticks",
};

function ddragonId(championName: string): string {
  return DDRAGON_ID_OVERRIDES[championName] ?? championName;
}

export function championIconUrl(championName: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ICON_VERSION}/img/champion/${ddragonId(championName)}.png`;
}

export function championSplashUrl(championName: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${ddragonId(championName)}_0.jpg`;
}
