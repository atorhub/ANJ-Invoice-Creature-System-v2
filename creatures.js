/* creatures.js
 * Simple registry mapping category -> asset paths (3 levels + badge)
 * Keep file names matching actual assets in repo.
 */
window.CreatureRegistry = {
  food: {
    id: "food",
    name: "Food",
    levels: [
      "food-xp1-Nibbi.png",
      "food-xp2-Nibbo.png",
      "food-xp3-Nibblaze.png"
    ],
    badge: "badges-512-food.png"
  },
  shopping: {
    id: "shopping",
    name: "Shopping",
    levels: [
      "shopping-xp1-Shoppy.png",
      "shopping-xp2-Shoppero.png",
      "shopping-xp3-Shopstorm.png"
    ],
    badge: "badges-512-shopping.png"
  },
  finance: {
    id: "finance",
    name: "Finance",
    levels: [
      "finance-xp1-Penny.png",
      "finance-xp2-Coino.png",
      "finance-xp3-Goldflare.png"
    ],
    badge: "badges-512-finance.png"
  }
};

window.getCreatureForCategory = function(cat){
  return window.CreatureRegistry[cat] || null;
};
