export function list() {
  return {
    "cherry": {
      sprite: ["fruits",0],
      name: ["Cherry","Cereza"],
      baseValue: 1,
      movement: "random",
      rarity: ["common",0.75],
      type: "fruit"  
    },
    "lemon": {
      sprite: ["fruits",1],
      name: ["Lemon","Limon"],
      baseValue: 1,
      movement: "random",
      rarity: ["common",0.55],
      type: "fruit"  
    },
    "banana": {
      sprite: ["fruits",2],
      name: ["Banana","Banana"],
      baseValue: 1,
      movement: "random",
      rarity: ["common",0.30],
      type: "fruit"  
    },
    "strawberry": {
      sprite: ["fruits",3],
      name: ["Strawberry","Fresa"],
      baseValue: 1,
      movement: "movable",
      rarity: ["common",0.20],
      type: "fruit"  
    },
    "watermelon": {
      sprite: ["fruits",5],
      name: ["Watermelon","Sandia"],
      baseValue: 3,
      movement: "random",
      rarity: ["common",0.25],
      type: "fruit"  
    },
    "orange": {
      sprite: ["fruits",4],
      name: ["Orange","Naranja"],
      baseValue: 2,
      movement: "random",
      rarity: ["common",0.15],
      type: "fruit"  
    },
  };  
}

export function generateSymbol() {
  const symbols = list();
  const randomValue = Math.random();
  const sortedSymbols = Object.entries(symbols)
    .sort((a, b) => a[1].rarity[1] - b[1].rarity[1]);
  for (let i = 0; i < sortedSymbols.length; i++) {
    const [key, symbol] = sortedSymbols[i];
    const rarityValue = symbol.rarity[1];
    if (randomValue < rarityValue) {
      return { key, ...symbol };
    }
  }
  const [highestKey, highestSymbol] = sortedSymbols[sortedSymbols.length - 1];
  return { key: highestKey, ...highestSymbol };
}