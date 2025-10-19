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
      rarity: ["common",0.45],
      type: "fruit"  
    },
    "strawberry": {
      sprite: ["fruits",3],
      name: ["Strawberry","Fresa"],
      baseValue: 1,
      movement: "movable",
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
    "watermelon": {
      sprite: ["fruits",5],
      name: ["Watermelon","Sandia"],
      baseValue: 3,
      movement: "random",
      rarity: ["common",0.45],
      type: "fruit"  
    },
    "coconut": {
      sprite: ["fruits",6],
      name: ["Coconut","Coco"],
      baseValue: 1,
      movement: "movable",
      rarity: ["common",0.35],
      type: "fruit"  
    },
    "grape": {
      sprite: ["fruits",7],
      name: ["Grape","Uvas"],
      baseValue: 1,
      movement: "random",
      destructionType: "sameKey",
      rarity: ["common",0.35],
      type: "fruit"  
    },
    "peach": {
      sprite: ["fruits",8],
      name: ["Peach","Melocoton"],
      baseValue: 1,
      movement: "random",
      rarity: ["common",0.20],
      type: "fruit"  
    },
  };  
}

export function generateSymbol() {
  const symbols = list();
  const entries = Object.entries(symbols);

  const totalWeight = entries.reduce((sum, [, s]) => sum + s.rarity[1], 0);
  let r = Math.random() * totalWeight;

  for (const [key, s] of entries) {
    r -= s.rarity[1];
    if (r <= 0) return { key, ...s };
  }
  const [key, s] = entries[entries.length - 1];
  return { key, ...s };
}
