# Future Features

## AI Place Suggestions + Saved Places + Trip Map

**Vision:** Make Visa Atlas the app users open when they land — not Google Maps.

Google Maps is for navigation. Visa Atlas is for "where should I go?"

### The killer flow:

1. User creates a trip to Tokyo
2. App generates AI suggestions: "Top picks for you" — restaurants, cafes, activities, nightlife — curated to their vibe (we already capture vibe, budget, interests in the trip planner)
3. Each suggestion has: name, photo, rating, cuisine/type, price range, address, why it's recommended ("Based on your foodie interest")
4. User swipes through, taps a heart to save, or dismisses
5. Saved places appear on an interactive map within the trip detail — clustered by day or category
6. When they're in Tokyo, they open the trip, see their saved places on the map, tap one → one button opens Google Maps/Apple Maps for directions
7. They can also add their own places (manual or scan)

### The data layer:

- Use **Google Places API** for real restaurant/activity data (photos, ratings, opening hours, price level)
- **AI curates and ranks** the results based on the trip's vibe + budget + interests
- **Saved places** stored in Convex, linked to the trip
- Places displayed on a **map** using the existing react-native-maps

### Why this is better than Google Maps sync:

- No "please grant access to your Google account" friction
- Works offline (saved places are cached)
- Context-aware — places are organized by YOUR trip, not just random pins
- The AI curation makes it personal, not just "top rated on Google"
- One tap to navigate when you need directions — best of both worlds

### This is essentially 3 features in one:

1. **AI Place Suggestions** — curated per trip
2. **Saved Places** — new Convex table, linked to trips
3. **Trip Map View** — interactive map in trip detail showing all saved places + bookings
