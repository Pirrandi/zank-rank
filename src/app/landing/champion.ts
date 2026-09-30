const DDRAGON_VERSION = "14.24.1";

export function championImage(champion: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${champion}.png`;
}
