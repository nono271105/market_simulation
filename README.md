# Market Simulation

Lien : [ag-market-simulation.vercel.app](https://ag-market-simulation.vercel.app)

Un simulateur de marché financier en temps réel construit avec React + Vite.

## Features

- **5 actifs** cotés en continu — tech, énergie, pharma, industrie, consommation
- **7 agents algorithmiques** aux stratégies distinctes : trend follower, mean reversion, momentum, fondamental, noise trader, contrarian, et un market maker (Citadel)
- **Moteur de prix GBM** (Geometric Brownian Motion) avec volatilité dynamique EWMA et mean-reversion vers la fair value
- **Carnet d'ordres** en temps réel avec spread dynamique
- **Flux de news** qui impactent progressivement les prix (~20 ticks de diffusion)
- **Earnings, dividendes, splits** générés automatiquement
- **Scénarios macro** : Crise 2008, Bulle Tech, Stagflation, Bull Run
- **Mode joueur** : achetez et vendez en compétition contre les agents

## Stack

- React 18
- Vite
- Recharts

## Lancer en local

```bash
npm install
npm run dev
```

## Live

[ag-market-simulation.vercel.app](https://ag-market-simulation.vercel.app)

## Déploiement

```bash
vercel --prod
```

---

*Construit avec [Claude.ai](https://claude.ai)*