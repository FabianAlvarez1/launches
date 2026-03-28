# 🚀 Launches
### A modern, immersive way to explore space launches

**Launches** is a minimalist web application designed to explore space launches across multiple agencies worldwide.  
Instead of focusing on raw data, the project aims to provide an immersive, smooth, and visually engaging experience where users can naturally explore upcoming and past launches through motion and interaction.

The interface combines horizontal scrolling, real-time data, and 3D visualization to transform how launch information is consumed.

[Click here to try it!](https://fabianalvarez1.github.io/launches/)

---

## ✨ Features

- 🌍 Upcoming & past space launches from multiple agencies  
- 🛰️ Real-time data powered by **The Space Devs API**  
- 🌌 Interactive 3D planet animation synchronized with scroll  
- 🧭 Custom horizontal scrolling experience  
- ⏱️ Local time reference for launch countdown awareness  
- 📦 Smart client-side caching using `localStorage`  
- ⚡ Reduced API calls with time-based cache invalidation  
- 🎨 Clean, minimalist, and responsive layout  
- 🖥️ Desktop-first experience (mobile intentionally restricted)

---

## 🧠 Philosophy

> Space exploration is not just about data —  
> it’s about movement, timing, and perspective.

This project avoids traditional dashboards and tables.  
Instead, it emphasizes motion, flow, and spatial context, allowing users to feel the progression of time and distance between launches.

---

## 🛠️ Tech Stack

- **HTML5**
- **CSS3 / Tailwind CSS**
- **JavaScript (Vanilla)**
- **Three.js** (3D rendering)
- **The Space Devs API**
- **localStorage** (client-side caching)

---

## 📦 Data & Caching Strategy

To avoid unnecessary API requests and improve performance:

- Launch data is cached in `localStorage`
- Cache expires automatically every **10 minutes**
- Users can refresh the page freely without triggering new requests
- Ensures fast loads while keeping data reasonably fresh

---

## 🧪 Current Limitations

- Mobile devices are not supported (by design)
- Some launch data may change due to mission updates
- Live streams depend on availability from the provider

---

## 🚧 Future Improvements

- 🌐 Filters by agency, rocket, or launch site
- 🔴 Live launch state detection
- ⏳ Countdown timers per launch
- 🧠 Service Worker caching (offline support)
- 📊 Historical launch analytics
- 🎥 Embedded live streams

---

## 📡 Data Source

Launch data provided by:

**The Space Devs**  
https://thespacedevs.com/

---

## 🧑‍🚀 Author

Built with passion for space, motion, and clean engineering.

**Fabian Álvarez Ávila**

