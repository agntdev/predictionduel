# GENERAL Design Document: Prediction Duel Bot

## Summary

The Prediction Duel Bot is a Telegram bot that enables users to create and participate in prediction-based challenges about future events. Users can stake points, make predictions, and earn reputation based on their accuracy. The bot automatically resolves duels when the event's outcome is known, updates leaderboards, and allows users to build a forecasting track record. It is designed for a broad audience interested in forecasting, including enthusiasts of cryptocurrency, sports, gaming, and weather.

## Core Entities

- **User**: A Telegram user who can create, join, and participate in prediction duels. Attributes include user ID, display name, reputation score, and a history of predictions.
- **Prediction Duel**: A challenge created by a user for a specific event. Attributes include duel ID, title, description, event type, deadline, result status, and stakes.
- **Prediction**: A user's forecast for a specific duel. Attributes include prediction ID, user ID, duel ID, predicted outcome, and timestamp.
- **Event**: A real-world event that the duel is based on. Attributes include event ID, name, type, date, and source of truth (e.g., API, manual input).
- **Stake**: The amount of points a user is willing to wager on a prediction. Attributes include stake ID, user ID, duel ID, and amount.
- **Leaderboard**: A public ranking of users based on their reputation score. Attributes include user ID, score, and rank.
- **Reputation Score**: A numerical representation of a user's forecasting accuracy. Attributes include user ID and score.

## Relationships

- A **User** can create multiple **Prediction Duels**.
- A **Prediction Duel** is associated with one **Event**.
- A **Prediction Duel** can have multiple **Predictions** from different **Users**.
- A **Prediction** is linked to a **Stake**.
- A **User** has a **Reputation Score** and appears on the **Leaderboard**.

## External Dependencies

- **Telegram Bot API**: Used for message handling, inline buttons, user authentication, and notifications.
- **Third-party APIs** (optional):
  - **Crypto price APIs** (e.g., CoinGecko, CoinMarketCap) for resolving crypto-related events.
  - **Sports APIs** (e.g., Sportradar, API-Sports) for resolving sports match outcomes.
  - **Weather APIs** (e.g., OpenWeatherMap) for resolving weather-based events.
- **Database**: Required to persist users, prediction duels, predictions, stakes, events, and reputation scores.
- **Scheduled Task System** (e.g., cron jobs or cloud functions): Used to periodically check for event outcomes and resolve duels.

## Feature List

- [x] User registration and authentication via Telegram.
- [x] Create a new prediction duel with title, description, event type, and deadline.
- [x] Stake points when making a prediction.
- [x] Make a prediction for a specific duel.
- [x] View active and past prediction duels.
- [x] Automatically resolve duels when the event's outcome is known.
- [x] Update user reputation scores based on prediction accuracy.
- [x] Maintain a public leaderboard of users by reputation score.
- [x] Allow users to challenge top predictors in their niche.
- [x] Send notifications when a duel is resolved or a user is challenged.
- [x] View personal prediction history and track record.
- [x] View duel details, including participants and predictions.
- [x] Admin commands for manual duel resolution and event updates.
- [x] Support for multiple event types (crypto, sports, games, weather, etc.).
- [x] Export duel results and user statistics.

## Non-Goals / Out of Scope

- Integration with real cryptocurrency for staking.
- Real-time event tracking (e.g., live sports scores).
- User-to-user messaging or private challenges.
- Complex betting odds or financial derivatives.
- Multiplayer or team-based prediction duels.
- Social media sharing or external platform integration.
- Advanced analytics or machine learning for prediction accuracy.