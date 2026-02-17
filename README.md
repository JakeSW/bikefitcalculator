# Bike Fit Cockpit Calculator

A browser-based tool that translates professional bike fit measurements into the specific components you need for a given frame — or checks what fit numbers a particular setup produces.

**Live site:** [jakesw.github.io/bikefit](https://jakesw.github.io/bikefit)

## Features

### Components → Fit (Forward Mode)
Enter your frame geometry and components (stem, spacers, handlebars, saddle position) to calculate the resulting fit numbers:
- Saddle-to-hood reach, drop, and straight-line distance
- Effective seat and torso angles
- BB setback

### Fit Targets → Components (Reverse Mode)
Enter your desired fit measurements and the calculator solves for the stem length, spacer stack, and stem angle needed to achieve them. Three constraint modes let you fix one variable and solve for the other two.

### Frame Comparison
Select any two frames from the built-in database and compare them side by side with an overlaid SVG diagram and geometry difference table.

### Interactive SVG Diagram
A real-time geometry diagram shows the frame, stem, spacers, and handlebar position, with labelled dimension lines updating as you change inputs.

### Preset Frame Database
Built-in geometry data for 67 models across 22 brands including Canyon, Cervélo, Trek, Specialized, Pinarello, Giant, Colnago, Bianchi, Scott, BMC, Factor, Cannondale, Ridley, Wilier, Merida, Van Rysel, Orbea, Lapierre, Quick Pro, Winspace, Time, and Look. Searchable modal with size buttons — select a bike to instantly load its geometry.

## How It Works

All calculations use the geometric relationship between the bottom bracket (BB), saddle, and hood positions. The frame's **stack**, **reach**, **seat tube angle**, and **head tube angle** define the skeleton. Components (stem, spacers, handlebars) extend from the top of the head tube to the hood position along the steerer and stem axes using trigonometry.

## Tech Stack

Pure HTML, CSS, and JavaScript — no build tools, no frameworks, no dependencies. A single `index.html` file with embedded styles and scripts, plus `bike-database.js` for the frame geometry data. Works offline once loaded.

## Adding a Bike to the Database

Edit `bike-database.js` and add an entry following this structure:

```javascript
"Brand": {
  "Model": {
    year: 2026,
    sizes: {
      "Size": { stack: 550, reach: 390, sta: 73.5, hta: 73.0 },
      // ... more sizes
    }
  }
}
```

- **stack** — vertical distance from BB centre to head tube top (mm)
- **reach** — horizontal distance from BB centre to head tube top (mm)
- **sta** — seat tube angle (degrees)
- **hta** — head tube angle (degrees)

Set values to `null` for sizes where geometry data isn't yet available — they'll appear dimmed in the preset selector.

## License

[MIT](LICENSE)
