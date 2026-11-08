// Curated TriviaGen item bank: 300 unique everyday objects across ten categories.
// Difficulty is mixed (50% Easy, 40% Medium, 10% Hard). Images resolve at runtime from Wikimedia Commons.
const items = [
  {
    "name": "Broom",
    "category": "Household Items",
    "description": "Broom is a household item commonly used around the home.",
    "aliases": [
      "Broom"
    ],
    "imageSearch": "Broom isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Mop",
    "category": "Household Items",
    "description": "Mop is a household item commonly used around the home.",
    "aliases": [
      "Mop"
    ],
    "imageSearch": "Mop isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Vacuum Cleaner",
    "category": "Household Items",
    "description": "Vacuum Cleaner is a household item commonly used around the home.",
    "aliases": [
      "Vacuum Cleaner"
    ],
    "imageSearch": "Vacuum Cleaner isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Dustpan",
    "category": "Household Items",
    "description": "Dustpan is a household item commonly used around the home.",
    "aliases": [
      "Dustpan"
    ],
    "imageSearch": "Dustpan isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Bucket",
    "category": "Household Items",
    "description": "Bucket is a household item commonly used around the home.",
    "aliases": [
      "Bucket"
    ],
    "imageSearch": "Bucket isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Clothes Hanger",
    "category": "Household Items",
    "description": "Clothes Hanger is a household item commonly used around the home.",
    "aliases": [
      "Clothes Hanger"
    ],
    "imageSearch": "Clothes Hanger isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Laundry Basket",
    "category": "Household Items",
    "description": "Laundry Basket is a household item commonly used around the home.",
    "aliases": [
      "Laundry Basket"
    ],
    "imageSearch": "Laundry Basket isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Ironing Board",
    "category": "Household Items",
    "description": "Ironing Board is a household item commonly used around the home.",
    "aliases": [
      "Ironing Board"
    ],
    "imageSearch": "Ironing Board isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Desk Lamp",
    "category": "Household Items",
    "description": "Desk Lamp is a household item commonly used around the home.",
    "aliases": [
      "Desk Lamp"
    ],
    "imageSearch": "Desk Lamp isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Table Lamp",
    "category": "Household Items",
    "description": "Table Lamp is a household item commonly used around the home.",
    "aliases": [
      "Table Lamp"
    ],
    "imageSearch": "Table Lamp isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Wall Clock",
    "category": "Household Items",
    "description": "Wall Clock is a household item commonly used around the home.",
    "aliases": [
      "Wall Clock"
    ],
    "imageSearch": "Wall Clock isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Alarm Clock",
    "category": "Household Items",
    "description": "Alarm Clock is a household item commonly used around the home.",
    "aliases": [
      "Alarm Clock"
    ],
    "imageSearch": "Alarm Clock isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Mirror",
    "category": "Household Items",
    "description": "Mirror is a household item commonly used around the home.",
    "aliases": [
      "Mirror"
    ],
    "imageSearch": "Mirror isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Door Mat",
    "category": "Household Items",
    "description": "Door Mat is a household item commonly used around the home.",
    "aliases": [
      "Door Mat"
    ],
    "imageSearch": "Door Mat isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Curtain",
    "category": "Household Items",
    "description": "Curtain is a household item commonly used around the home.",
    "aliases": [
      "Curtain"
    ],
    "imageSearch": "Curtain isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Pillow",
    "category": "Household Items",
    "description": "Pillow is a household item commonly used around the home.",
    "aliases": [
      "Pillow"
    ],
    "imageSearch": "Pillow isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Blanket",
    "category": "Household Items",
    "description": "Blanket is a household item commonly used around the home.",
    "aliases": [
      "Blanket"
    ],
    "imageSearch": "Blanket isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Bedsheet",
    "category": "Household Items",
    "description": "Bedsheet is a household item commonly used around the home.",
    "aliases": [
      "Bedsheet"
    ],
    "imageSearch": "Bedsheet isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Mattress",
    "category": "Household Items",
    "description": "Mattress is a household item commonly used around the home.",
    "aliases": [
      "Mattress"
    ],
    "imageSearch": "Mattress isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Bookshelf",
    "category": "Household Items",
    "description": "Bookshelf is a household item commonly used around the home.",
    "aliases": [
      "Bookshelf"
    ],
    "imageSearch": "Bookshelf isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Shoe Rack",
    "category": "Household Items",
    "description": "Shoe Rack is a household item commonly used around the home.",
    "aliases": [
      "Shoe Rack"
    ],
    "imageSearch": "Shoe Rack isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Coat Rack",
    "category": "Household Items",
    "description": "Coat Rack is a household item commonly used around the home.",
    "aliases": [
      "Coat Rack"
    ],
    "imageSearch": "Coat Rack isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Trash Can",
    "category": "Household Items",
    "description": "Trash Can is a household item commonly used around the home.",
    "aliases": [
      "Trash Can",
      "Rubbish Bin",
      "Garbage Can"
    ],
    "imageSearch": "Trash Can isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Storage Box",
    "category": "Household Items",
    "description": "Storage Box is a household item commonly used around the home.",
    "aliases": [
      "Storage Box"
    ],
    "imageSearch": "Storage Box isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Flashlight",
    "category": "Household Items",
    "description": "Flashlight is a household item commonly used around the home.",
    "aliases": [
      "Flashlight",
      "Torch"
    ],
    "imageSearch": "Flashlight isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Extension Cord",
    "category": "Household Items",
    "description": "Extension Cord is a household item commonly used around the home.",
    "aliases": [
      "Extension Cord"
    ],
    "imageSearch": "Extension Cord isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Power Strip",
    "category": "Household Items",
    "description": "Power Strip is a household item commonly used around the home.",
    "aliases": [
      "Power Strip"
    ],
    "imageSearch": "Power Strip isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Fan",
    "category": "Household Items",
    "description": "Fan is a household item commonly used around the home.",
    "aliases": [
      "Fan"
    ],
    "imageSearch": "Fan isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Heater",
    "category": "Household Items",
    "description": "Heater is a household item commonly used around the home.",
    "aliases": [
      "Heater"
    ],
    "imageSearch": "Heater isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Air Freshener",
    "category": "Household Items",
    "description": "Air Freshener is a household item commonly used around the home.",
    "aliases": [
      "Air Freshener"
    ],
    "imageSearch": "Air Freshener isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Electric Kettle",
    "category": "Kitchen Items",
    "description": "Electric Kettle is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Electric Kettle",
      "Kettle"
    ],
    "imageSearch": "Electric Kettle isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Toaster",
    "category": "Kitchen Items",
    "description": "Toaster is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Toaster"
    ],
    "imageSearch": "Toaster isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Blender",
    "category": "Kitchen Items",
    "description": "Blender is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Blender"
    ],
    "imageSearch": "Blender isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Microwave Oven",
    "category": "Kitchen Items",
    "description": "Microwave Oven is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Microwave Oven",
      "Microwave"
    ],
    "imageSearch": "Microwave Oven isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Refrigerator",
    "category": "Kitchen Items",
    "description": "Refrigerator is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Refrigerator",
      "Fridge"
    ],
    "imageSearch": "Refrigerator isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Freezer",
    "category": "Kitchen Items",
    "description": "Freezer is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Freezer"
    ],
    "imageSearch": "Freezer isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Rice Cooker",
    "category": "Kitchen Items",
    "description": "Rice Cooker is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Rice Cooker"
    ],
    "imageSearch": "Rice Cooker isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Coffee Maker",
    "category": "Kitchen Items",
    "description": "Coffee Maker is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Coffee Maker"
    ],
    "imageSearch": "Coffee Maker isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Frying Pan",
    "category": "Kitchen Items",
    "description": "Frying Pan is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Frying Pan",
      "Pan"
    ],
    "imageSearch": "Frying Pan isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Saucepan",
    "category": "Kitchen Items",
    "description": "Saucepan is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Saucepan"
    ],
    "imageSearch": "Saucepan isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Cooking Pot",
    "category": "Kitchen Items",
    "description": "Cooking Pot is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Cooking Pot"
    ],
    "imageSearch": "Cooking Pot isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Baking Tray",
    "category": "Kitchen Items",
    "description": "Baking Tray is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Baking Tray"
    ],
    "imageSearch": "Baking Tray isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Cutting Board",
    "category": "Kitchen Items",
    "description": "Cutting Board is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Cutting Board"
    ],
    "imageSearch": "Cutting Board isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Chef Knife",
    "category": "Kitchen Items",
    "description": "Chef Knife is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Chef Knife",
      "Kitchen Knife"
    ],
    "imageSearch": "Chef Knife isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Peeler",
    "category": "Kitchen Items",
    "description": "Peeler is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Peeler"
    ],
    "imageSearch": "Peeler isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Can Opener",
    "category": "Kitchen Items",
    "description": "Can Opener is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Can Opener"
    ],
    "imageSearch": "Can Opener isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Bottle Opener",
    "category": "Kitchen Items",
    "description": "Bottle Opener is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Bottle Opener"
    ],
    "imageSearch": "Bottle Opener isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Whisk",
    "category": "Kitchen Items",
    "description": "Whisk is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Whisk"
    ],
    "imageSearch": "Whisk isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Spatula",
    "category": "Kitchen Items",
    "description": "Spatula is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Spatula"
    ],
    "imageSearch": "Spatula isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Ladle",
    "category": "Kitchen Items",
    "description": "Ladle is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Ladle"
    ],
    "imageSearch": "Ladle isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Tongs",
    "category": "Kitchen Items",
    "description": "Tongs is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Tongs"
    ],
    "imageSearch": "Tongs isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Colander",
    "category": "Kitchen Items",
    "description": "Colander is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Colander"
    ],
    "imageSearch": "Colander isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Measuring Cup",
    "category": "Kitchen Items",
    "description": "Measuring Cup is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Measuring Cup"
    ],
    "imageSearch": "Measuring Cup isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Rolling Pin",
    "category": "Kitchen Items",
    "description": "Rolling Pin is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Rolling Pin"
    ],
    "imageSearch": "Rolling Pin isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Grater",
    "category": "Kitchen Items",
    "description": "Grater is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Grater"
    ],
    "imageSearch": "Grater isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Garlic Press",
    "category": "Kitchen Items",
    "description": "Garlic Press is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Garlic Press"
    ],
    "imageSearch": "Garlic Press isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Tea Strainer",
    "category": "Kitchen Items",
    "description": "Tea Strainer is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Tea Strainer"
    ],
    "imageSearch": "Tea Strainer isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Thermos Flask",
    "category": "Kitchen Items",
    "description": "Thermos Flask is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Thermos Flask"
    ],
    "imageSearch": "Thermos Flask isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Food Container",
    "category": "Kitchen Items",
    "description": "Food Container is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Food Container"
    ],
    "imageSearch": "Food Container isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Dish Rack",
    "category": "Kitchen Items",
    "description": "Dish Rack is a kitchen tool or appliance used to prepare, serve, or store food.",
    "aliases": [
      "Dish Rack"
    ],
    "imageSearch": "Dish Rack isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Keyboard",
    "category": "Electronics",
    "description": "Keyboard is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Keyboard"
    ],
    "imageSearch": "Keyboard isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Computer Mouse",
    "category": "Electronics",
    "description": "Computer Mouse is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Computer Mouse",
      "Mouse"
    ],
    "imageSearch": "Computer Mouse isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Computer Monitor",
    "category": "Electronics",
    "description": "Computer Monitor is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Computer Monitor",
      "Monitor"
    ],
    "imageSearch": "Computer Monitor isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Laptop",
    "category": "Electronics",
    "description": "Laptop is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Laptop"
    ],
    "imageSearch": "Laptop isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Tablet",
    "category": "Electronics",
    "description": "Tablet is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Tablet"
    ],
    "imageSearch": "Tablet isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Smartphone",
    "category": "Electronics",
    "description": "Smartphone is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Smartphone",
      "Mobile Phone",
      "Cell Phone"
    ],
    "imageSearch": "Smartphone isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Headphones",
    "category": "Electronics",
    "description": "Headphones is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Headphones",
      "Headset"
    ],
    "imageSearch": "Headphones isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Earbuds",
    "category": "Electronics",
    "description": "Earbuds is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Earbuds"
    ],
    "imageSearch": "Earbuds isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Bluetooth Speaker",
    "category": "Electronics",
    "description": "Bluetooth Speaker is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Bluetooth Speaker"
    ],
    "imageSearch": "Bluetooth Speaker isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Television",
    "category": "Electronics",
    "description": "Television is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Television"
    ],
    "imageSearch": "Television isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Remote Control",
    "category": "Electronics",
    "description": "Remote Control is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Remote Control"
    ],
    "imageSearch": "Remote Control isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Router",
    "category": "Electronics",
    "description": "Router is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Router"
    ],
    "imageSearch": "Router isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Modem",
    "category": "Electronics",
    "description": "Modem is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Modem"
    ],
    "imageSearch": "Modem isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Webcam",
    "category": "Electronics",
    "description": "Webcam is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Webcam"
    ],
    "imageSearch": "Webcam isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Microphone",
    "category": "Electronics",
    "description": "Microphone is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Microphone"
    ],
    "imageSearch": "Microphone isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Printer",
    "category": "Electronics",
    "description": "Printer is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Printer"
    ],
    "imageSearch": "Printer isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Scanner",
    "category": "Electronics",
    "description": "Scanner is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Scanner"
    ],
    "imageSearch": "Scanner isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "USB Flash Drive",
    "category": "Electronics",
    "description": "USB Flash Drive is an electronic device or accessory used in everyday life.",
    "aliases": [
      "USB Flash Drive"
    ],
    "imageSearch": "USB Flash Drive isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "External Hard Drive",
    "category": "Electronics",
    "description": "External Hard Drive is an electronic device or accessory used in everyday life.",
    "aliases": [
      "External Hard Drive"
    ],
    "imageSearch": "External Hard Drive isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Power Bank",
    "category": "Electronics",
    "description": "Power Bank is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Power Bank"
    ],
    "imageSearch": "Power Bank isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Phone Charger",
    "category": "Electronics",
    "description": "Phone Charger is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Phone Charger"
    ],
    "imageSearch": "Phone Charger isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "HDMI Cable",
    "category": "Electronics",
    "description": "HDMI Cable is an electronic device or accessory used in everyday life.",
    "aliases": [
      "HDMI Cable"
    ],
    "imageSearch": "HDMI Cable isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Game Controller",
    "category": "Electronics",
    "description": "Game Controller is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Game Controller"
    ],
    "imageSearch": "Game Controller isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Digital Camera",
    "category": "Electronics",
    "description": "Digital Camera is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Digital Camera"
    ],
    "imageSearch": "Digital Camera isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Tripod",
    "category": "Electronics",
    "description": "Tripod is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Tripod"
    ],
    "imageSearch": "Tripod isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Smartwatch",
    "category": "Electronics",
    "description": "Smartwatch is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Smartwatch"
    ],
    "imageSearch": "Smartwatch isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Calculator",
    "category": "Electronics",
    "description": "Calculator is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Calculator"
    ],
    "imageSearch": "Calculator isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Projector",
    "category": "Electronics",
    "description": "Projector is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Projector"
    ],
    "imageSearch": "Projector isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Memory Card",
    "category": "Electronics",
    "description": "Memory Card is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Memory Card"
    ],
    "imageSearch": "Memory Card isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Portable SSD",
    "category": "Electronics",
    "description": "Portable SSD is an electronic device or accessory used in everyday life.",
    "aliases": [
      "Portable SSD"
    ],
    "imageSearch": "Portable SSD isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Hammer",
    "category": "Tools & Equipment",
    "description": "Hammer is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Hammer"
    ],
    "imageSearch": "Hammer isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Screwdriver",
    "category": "Tools & Equipment",
    "description": "Screwdriver is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Screwdriver",
      "Screw Driver"
    ],
    "imageSearch": "Screwdriver isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Adjustable Wrench",
    "category": "Tools & Equipment",
    "description": "Adjustable Wrench is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Adjustable Wrench",
      "Wrench"
    ],
    "imageSearch": "Adjustable Wrench isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Pliers",
    "category": "Tools & Equipment",
    "description": "Pliers is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Pliers"
    ],
    "imageSearch": "Pliers isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Allen Key",
    "category": "Tools & Equipment",
    "description": "Allen Key is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Allen Key"
    ],
    "imageSearch": "Allen Key isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Measuring Tape",
    "category": "Tools & Equipment",
    "description": "Measuring Tape is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Measuring Tape"
    ],
    "imageSearch": "Measuring Tape isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Spirit Level",
    "category": "Tools & Equipment",
    "description": "Spirit Level is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Spirit Level"
    ],
    "imageSearch": "Spirit Level isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Hand Saw",
    "category": "Tools & Equipment",
    "description": "Hand Saw is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Hand Saw"
    ],
    "imageSearch": "Hand Saw isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Utility Knife",
    "category": "Tools & Equipment",
    "description": "Utility Knife is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Utility Knife"
    ],
    "imageSearch": "Utility Knife isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Drill",
    "category": "Tools & Equipment",
    "description": "Drill is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Drill"
    ],
    "imageSearch": "Drill isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Electric Screwdriver",
    "category": "Tools & Equipment",
    "description": "Electric Screwdriver is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Electric Screwdriver"
    ],
    "imageSearch": "Electric Screwdriver isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Chisel",
    "category": "Tools & Equipment",
    "description": "Chisel is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Chisel"
    ],
    "imageSearch": "Chisel isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Paintbrush",
    "category": "Tools & Equipment",
    "description": "Paintbrush is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Paintbrush"
    ],
    "imageSearch": "Paintbrush isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Paint Roller",
    "category": "Tools & Equipment",
    "description": "Paint Roller is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Paint Roller"
    ],
    "imageSearch": "Paint Roller isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Ladder",
    "category": "Tools & Equipment",
    "description": "Ladder is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Ladder"
    ],
    "imageSearch": "Ladder isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Shovel",
    "category": "Tools & Equipment",
    "description": "Shovel is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Shovel"
    ],
    "imageSearch": "Shovel isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Rake",
    "category": "Tools & Equipment",
    "description": "Rake is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Rake"
    ],
    "imageSearch": "Rake isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Wheelbarrow",
    "category": "Tools & Equipment",
    "description": "Wheelbarrow is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Wheelbarrow"
    ],
    "imageSearch": "Wheelbarrow isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Garden Hose",
    "category": "Tools & Equipment",
    "description": "Garden Hose is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Garden Hose"
    ],
    "imageSearch": "Garden Hose isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Pruning Shears",
    "category": "Tools & Equipment",
    "description": "Pruning Shears is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Pruning Shears"
    ],
    "imageSearch": "Pruning Shears isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Clamp",
    "category": "Tools & Equipment",
    "description": "Clamp is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Clamp"
    ],
    "imageSearch": "Clamp isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Workbench Vise",
    "category": "Tools & Equipment",
    "description": "Workbench Vise is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Workbench Vise"
    ],
    "imageSearch": "Workbench Vise isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Socket Wrench",
    "category": "Tools & Equipment",
    "description": "Socket Wrench is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Socket Wrench"
    ],
    "imageSearch": "Socket Wrench isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Hacksaw",
    "category": "Tools & Equipment",
    "description": "Hacksaw is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Hacksaw"
    ],
    "imageSearch": "Hacksaw isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Crowbar",
    "category": "Tools & Equipment",
    "description": "Crowbar is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Crowbar"
    ],
    "imageSearch": "Crowbar isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Sandpaper",
    "category": "Tools & Equipment",
    "description": "Sandpaper is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Sandpaper"
    ],
    "imageSearch": "Sandpaper isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Staple Gun",
    "category": "Tools & Equipment",
    "description": "Staple Gun is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Staple Gun"
    ],
    "imageSearch": "Staple Gun isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Toolbox",
    "category": "Tools & Equipment",
    "description": "Toolbox is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Toolbox"
    ],
    "imageSearch": "Toolbox isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Safety Goggles",
    "category": "Tools & Equipment",
    "description": "Safety Goggles is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Safety Goggles"
    ],
    "imageSearch": "Safety Goggles isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Work Gloves",
    "category": "Tools & Equipment",
    "description": "Work Gloves is a tool or piece of equipment used for practical tasks and repairs.",
    "aliases": [
      "Work Gloves"
    ],
    "imageSearch": "Work Gloves isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Ballpoint Pen",
    "category": "Stationery",
    "description": "Ballpoint Pen is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Ballpoint Pen",
      "Pen"
    ],
    "imageSearch": "Ballpoint Pen isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Pencil",
    "category": "Stationery",
    "description": "Pencil is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Pencil"
    ],
    "imageSearch": "Pencil isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Eraser",
    "category": "Stationery",
    "description": "Eraser is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Eraser"
    ],
    "imageSearch": "Eraser isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Pencil Sharpener",
    "category": "Stationery",
    "description": "Pencil Sharpener is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Pencil Sharpener",
      "Sharpener"
    ],
    "imageSearch": "Pencil Sharpener isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Ruler",
    "category": "Stationery",
    "description": "Ruler is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Ruler"
    ],
    "imageSearch": "Ruler isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Notebook",
    "category": "Stationery",
    "description": "Notebook is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Notebook",
      "Exercise Book"
    ],
    "imageSearch": "Notebook isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Sticky Notes",
    "category": "Stationery",
    "description": "Sticky Notes is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Sticky Notes",
      "Post It Notes",
      "Post-it Notes"
    ],
    "imageSearch": "Sticky Notes isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Stapler",
    "category": "Stationery",
    "description": "Stapler is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Stapler"
    ],
    "imageSearch": "Stapler isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Staple Remover",
    "category": "Stationery",
    "description": "Staple Remover is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Staple Remover"
    ],
    "imageSearch": "Staple Remover isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Paper Clips",
    "category": "Stationery",
    "description": "Paper Clips is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Paper Clips"
    ],
    "imageSearch": "Paper Clips isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Binder Clips",
    "category": "Stationery",
    "description": "Binder Clips is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Binder Clips"
    ],
    "imageSearch": "Binder Clips isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Highlighter",
    "category": "Stationery",
    "description": "Highlighter is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Highlighter"
    ],
    "imageSearch": "Highlighter isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Marker Pen",
    "category": "Stationery",
    "description": "Marker Pen is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Marker Pen"
    ],
    "imageSearch": "Marker Pen isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Whiteboard Marker",
    "category": "Stationery",
    "description": "Whiteboard Marker is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Whiteboard Marker"
    ],
    "imageSearch": "Whiteboard Marker isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Whiteboard",
    "category": "Stationery",
    "description": "Whiteboard is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Whiteboard"
    ],
    "imageSearch": "Whiteboard isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Scissors",
    "category": "Stationery",
    "description": "Scissors is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Scissors"
    ],
    "imageSearch": "Scissors isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Glue Stick",
    "category": "Stationery",
    "description": "Glue Stick is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Glue Stick"
    ],
    "imageSearch": "Glue Stick isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Tape Dispenser",
    "category": "Stationery",
    "description": "Tape Dispenser is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Tape Dispenser"
    ],
    "imageSearch": "Tape Dispenser isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Adhesive Tape",
    "category": "Stationery",
    "description": "Adhesive Tape is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Adhesive Tape"
    ],
    "imageSearch": "Adhesive Tape isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Correction Tape",
    "category": "Stationery",
    "description": "Correction Tape is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Correction Tape"
    ],
    "imageSearch": "Correction Tape isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Protractor",
    "category": "Stationery",
    "description": "Protractor is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Protractor"
    ],
    "imageSearch": "Protractor isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Compass",
    "category": "Stationery",
    "description": "Compass is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Compass"
    ],
    "imageSearch": "Compass isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Desk Calendar",
    "category": "Stationery",
    "description": "A desk calendar is a stationery item used to view dates and organize a schedule.",
    "aliases": [
      "Desk Calendar",
      "Desktop Calendar"
    ],
    "imageSearch": "Desk Calendar isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Folder",
    "category": "Stationery",
    "description": "Folder is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Folder"
    ],
    "imageSearch": "Folder isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Ring Binder",
    "category": "Stationery",
    "description": "Ring Binder is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Ring Binder"
    ],
    "imageSearch": "Ring Binder isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Envelope",
    "category": "Stationery",
    "description": "Envelope is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Envelope"
    ],
    "imageSearch": "Envelope isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Printer Paper",
    "category": "Stationery",
    "description": "Printer Paper is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Printer Paper"
    ],
    "imageSearch": "Printer Paper isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Index Cards",
    "category": "Stationery",
    "description": "Index Cards is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Index Cards"
    ],
    "imageSearch": "Index Cards isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Hole Punch",
    "category": "Stationery",
    "description": "Hole Punch is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Hole Punch"
    ],
    "imageSearch": "Hole Punch isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Desk Organizer",
    "category": "Stationery",
    "description": "Desk Organizer is a stationery or office supply used for writing, drawing, or organizing.",
    "aliases": [
      "Desk Organizer"
    ],
    "imageSearch": "Desk Organizer isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "T-Shirt",
    "category": "Clothing & Accessories",
    "description": "T-Shirt is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "T-Shirt",
      "T Shirt",
      "Tee Shirt"
    ],
    "imageSearch": "T-Shirt isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Hoodie",
    "category": "Clothing & Accessories",
    "description": "Hoodie is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Hoodie"
    ],
    "imageSearch": "Hoodie isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Jacket",
    "category": "Clothing & Accessories",
    "description": "Jacket is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Jacket"
    ],
    "imageSearch": "Jacket isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Coat",
    "category": "Clothing & Accessories",
    "description": "Coat is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Coat"
    ],
    "imageSearch": "Coat isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Jeans",
    "category": "Clothing & Accessories",
    "description": "Jeans is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Jeans"
    ],
    "imageSearch": "Jeans isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Trousers",
    "category": "Clothing & Accessories",
    "description": "Trousers is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Trousers"
    ],
    "imageSearch": "Trousers isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Shorts",
    "category": "Clothing & Accessories",
    "description": "Shorts is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Shorts"
    ],
    "imageSearch": "Shorts isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Socks",
    "category": "Clothing & Accessories",
    "description": "Socks is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Socks"
    ],
    "imageSearch": "Socks isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Sneakers",
    "category": "Clothing & Accessories",
    "description": "Sneakers is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Sneakers",
      "Trainers"
    ],
    "imageSearch": "Sneakers isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Boots",
    "category": "Clothing & Accessories",
    "description": "Boots is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Boots"
    ],
    "imageSearch": "Boots isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Sandals",
    "category": "Clothing & Accessories",
    "description": "Sandals is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Sandals"
    ],
    "imageSearch": "Sandals isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Belt",
    "category": "Clothing & Accessories",
    "description": "Belt is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Belt"
    ],
    "imageSearch": "Belt isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Baseball Cap",
    "category": "Clothing & Accessories",
    "description": "Baseball Cap is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Baseball Cap",
      "Cap"
    ],
    "imageSearch": "Baseball Cap isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Beanie",
    "category": "Clothing & Accessories",
    "description": "Beanie is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Beanie"
    ],
    "imageSearch": "Beanie isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Scarf",
    "category": "Clothing & Accessories",
    "description": "Scarf is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Scarf"
    ],
    "imageSearch": "Scarf isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Gloves",
    "category": "Clothing & Accessories",
    "description": "Gloves is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Gloves"
    ],
    "imageSearch": "Gloves isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Wristwatch",
    "category": "Clothing & Accessories",
    "description": "Wristwatch is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Wristwatch"
    ],
    "imageSearch": "Wristwatch isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Sunglasses",
    "category": "Clothing & Accessories",
    "description": "Sunglasses is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Sunglasses"
    ],
    "imageSearch": "Sunglasses isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Backpack",
    "category": "Clothing & Accessories",
    "description": "Backpack is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Backpack"
    ],
    "imageSearch": "Backpack isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Wallet",
    "category": "Clothing & Accessories",
    "description": "Wallet is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Wallet"
    ],
    "imageSearch": "Wallet isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Handbag",
    "category": "Clothing & Accessories",
    "description": "Handbag is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Handbag"
    ],
    "imageSearch": "Handbag isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Tie",
    "category": "Clothing & Accessories",
    "description": "Tie is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Tie"
    ],
    "imageSearch": "Tie isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Bow Tie",
    "category": "Clothing & Accessories",
    "description": "Bow Tie is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Bow Tie"
    ],
    "imageSearch": "Bow Tie isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Raincoat",
    "category": "Clothing & Accessories",
    "description": "Raincoat is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Raincoat"
    ],
    "imageSearch": "Raincoat isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Pajamas",
    "category": "Clothing & Accessories",
    "description": "Pajamas is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Pajamas"
    ],
    "imageSearch": "Pajamas isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Sports Jersey",
    "category": "Clothing & Accessories",
    "description": "Sports Jersey is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Sports Jersey"
    ],
    "imageSearch": "Sports Jersey isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Slippers",
    "category": "Clothing & Accessories",
    "description": "Slippers is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Slippers"
    ],
    "imageSearch": "Slippers isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Umbrella",
    "category": "Clothing & Accessories",
    "description": "Umbrella is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Umbrella"
    ],
    "imageSearch": "Umbrella isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Necklace",
    "category": "Clothing & Accessories",
    "description": "Necklace is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Necklace"
    ],
    "imageSearch": "Necklace isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Bracelet",
    "category": "Clothing & Accessories",
    "description": "Bracelet is an item of clothing or an accessory worn or carried.",
    "aliases": [
      "Bracelet"
    ],
    "imageSearch": "Bracelet isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Toothbrush",
    "category": "Personal Care",
    "description": "Toothbrush is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Toothbrush"
    ],
    "imageSearch": "Toothbrush isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Toothpaste",
    "category": "Personal Care",
    "description": "Toothpaste is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Toothpaste"
    ],
    "imageSearch": "Toothpaste isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Dental Floss",
    "category": "Personal Care",
    "description": "Dental Floss is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Dental Floss"
    ],
    "imageSearch": "Dental Floss isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Hairbrush",
    "category": "Personal Care",
    "description": "Hairbrush is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Hairbrush"
    ],
    "imageSearch": "Hairbrush isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Comb",
    "category": "Personal Care",
    "description": "Comb is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Comb"
    ],
    "imageSearch": "Comb isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Shampoo Bottle",
    "category": "Personal Care",
    "description": "Shampoo Bottle is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Shampoo Bottle"
    ],
    "imageSearch": "Shampoo Bottle isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Conditioner Bottle",
    "category": "Personal Care",
    "description": "Conditioner Bottle is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Conditioner Bottle"
    ],
    "imageSearch": "Conditioner Bottle isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Bar Soap",
    "category": "Personal Care",
    "description": "Bar Soap is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Bar Soap"
    ],
    "imageSearch": "Bar Soap isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Soap Dispenser",
    "category": "Personal Care",
    "description": "Soap Dispenser is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Soap Dispenser"
    ],
    "imageSearch": "Soap Dispenser isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Hand Sanitizer",
    "category": "Personal Care",
    "description": "Hand Sanitizer is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Hand Sanitizer"
    ],
    "imageSearch": "Hand Sanitizer isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Deodorant Stick",
    "category": "Personal Care",
    "description": "Deodorant Stick is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Deodorant Stick"
    ],
    "imageSearch": "Deodorant Stick isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Perfume Bottle",
    "category": "Personal Care",
    "description": "Perfume Bottle is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Perfume Bottle"
    ],
    "imageSearch": "Perfume Bottle isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Hair Dryer",
    "category": "Personal Care",
    "description": "Hair Dryer is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Hair Dryer",
      "Blow Dryer"
    ],
    "imageSearch": "Hair Dryer isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Hair Straightener",
    "category": "Personal Care",
    "description": "Hair Straightener is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Hair Straightener"
    ],
    "imageSearch": "Hair Straightener isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Electric Shaver",
    "category": "Personal Care",
    "description": "Electric Shaver is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Electric Shaver"
    ],
    "imageSearch": "Electric Shaver isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Razor",
    "category": "Personal Care",
    "description": "Razor is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Razor"
    ],
    "imageSearch": "Razor isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Nail Clippers",
    "category": "Personal Care",
    "description": "Nail Clippers is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Nail Clippers"
    ],
    "imageSearch": "Nail Clippers isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Nail File",
    "category": "Personal Care",
    "description": "Nail File is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Nail File"
    ],
    "imageSearch": "Nail File isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Tweezers",
    "category": "Personal Care",
    "description": "Tweezers is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Tweezers"
    ],
    "imageSearch": "Tweezers isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Cotton Swabs",
    "category": "Personal Care",
    "description": "Cotton Swabs is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Cotton Swabs"
    ],
    "imageSearch": "Cotton Swabs isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Cotton Pads",
    "category": "Personal Care",
    "description": "Cotton Pads is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Cotton Pads"
    ],
    "imageSearch": "Cotton Pads isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Face Towel",
    "category": "Personal Care",
    "description": "Face Towel is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Face Towel"
    ],
    "imageSearch": "Face Towel isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Bath Towel",
    "category": "Personal Care",
    "description": "Bath Towel is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Bath Towel"
    ],
    "imageSearch": "Bath Towel isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Loofah",
    "category": "Personal Care",
    "description": "Loofah is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Loofah"
    ],
    "imageSearch": "Loofah isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Shower Cap",
    "category": "Personal Care",
    "description": "Shower Cap is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Shower Cap"
    ],
    "imageSearch": "Shower Cap isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Makeup Brush",
    "category": "Personal Care",
    "description": "Makeup Brush is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Makeup Brush"
    ],
    "imageSearch": "Makeup Brush isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Lip Balm",
    "category": "Personal Care",
    "description": "Lip Balm is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Lip Balm"
    ],
    "imageSearch": "Lip Balm isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Moisturizer Bottle",
    "category": "Personal Care",
    "description": "Moisturizer Bottle is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Moisturizer Bottle"
    ],
    "imageSearch": "Moisturizer Bottle isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Tissue Box",
    "category": "Personal Care",
    "description": "Tissue Box is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "Tissue Box"
    ],
    "imageSearch": "Tissue Box isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "First Aid Kit",
    "category": "Personal Care",
    "description": "First Aid Kit is a personal-care or grooming item used for everyday hygiene.",
    "aliases": [
      "First Aid Kit"
    ],
    "imageSearch": "First Aid Kit isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Football",
    "category": "Sports Equipment",
    "description": "Football is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Football",
      "Soccer Ball"
    ],
    "imageSearch": "Football isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Basketball",
    "category": "Sports Equipment",
    "description": "Basketball is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Basketball"
    ],
    "imageSearch": "Basketball isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Tennis Racket",
    "category": "Sports Equipment",
    "description": "Tennis Racket is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Tennis Racket"
    ],
    "imageSearch": "Tennis Racket isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Badminton Racket",
    "category": "Sports Equipment",
    "description": "Badminton Racket is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Badminton Racket"
    ],
    "imageSearch": "Badminton Racket isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Volleyball",
    "category": "Sports Equipment",
    "description": "Volleyball is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Volleyball"
    ],
    "imageSearch": "Volleyball isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Baseball Bat",
    "category": "Sports Equipment",
    "description": "Baseball Bat is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Baseball Bat"
    ],
    "imageSearch": "Baseball Bat isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Baseball Glove",
    "category": "Sports Equipment",
    "description": "Baseball Glove is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Baseball Glove"
    ],
    "imageSearch": "Baseball Glove isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Cricket Bat",
    "category": "Sports Equipment",
    "description": "Cricket Bat is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Cricket Bat"
    ],
    "imageSearch": "Cricket Bat isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Hockey Stick",
    "category": "Sports Equipment",
    "description": "Hockey Stick is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Hockey Stick"
    ],
    "imageSearch": "Hockey Stick isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Golf Club",
    "category": "Sports Equipment",
    "description": "Golf Club is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Golf Club"
    ],
    "imageSearch": "Golf Club isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Golf Ball",
    "category": "Sports Equipment",
    "description": "Golf Ball is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Golf Ball"
    ],
    "imageSearch": "Golf Ball isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Table Tennis Paddle",
    "category": "Sports Equipment",
    "description": "Table Tennis Paddle is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Table Tennis Paddle"
    ],
    "imageSearch": "Table Tennis Paddle isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Table Tennis Ball",
    "category": "Sports Equipment",
    "description": "Table Tennis Ball is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Table Tennis Ball"
    ],
    "imageSearch": "Table Tennis Ball isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Jump Rope",
    "category": "Sports Equipment",
    "description": "Jump Rope is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Jump Rope"
    ],
    "imageSearch": "Jump Rope isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Yoga Mat",
    "category": "Sports Equipment",
    "description": "Yoga Mat is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Yoga Mat"
    ],
    "imageSearch": "Yoga Mat isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Dumbbell",
    "category": "Sports Equipment",
    "description": "Dumbbell is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Dumbbell"
    ],
    "imageSearch": "Dumbbell isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Kettlebell",
    "category": "Sports Equipment",
    "description": "Kettlebell is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Kettlebell"
    ],
    "imageSearch": "Kettlebell isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Barbell",
    "category": "Sports Equipment",
    "description": "Barbell is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Barbell"
    ],
    "imageSearch": "Barbell isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Resistance Band",
    "category": "Sports Equipment",
    "description": "Resistance Band is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Resistance Band"
    ],
    "imageSearch": "Resistance Band isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Exercise Ball",
    "category": "Sports Equipment",
    "description": "Exercise Ball is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Exercise Ball"
    ],
    "imageSearch": "Exercise Ball isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Boxing Gloves",
    "category": "Sports Equipment",
    "description": "Boxing Gloves is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Boxing Gloves"
    ],
    "imageSearch": "Boxing Gloves isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Shin Guards",
    "category": "Sports Equipment",
    "description": "Shin Guards is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Shin Guards"
    ],
    "imageSearch": "Shin Guards isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Soccer Cleats",
    "category": "Sports Equipment",
    "description": "Soccer Cleats is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Soccer Cleats",
      "Football Boots"
    ],
    "imageSearch": "Soccer Cleats isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Whistle",
    "category": "Sports Equipment",
    "description": "Whistle is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Whistle"
    ],
    "imageSearch": "Whistle isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Stopwatch",
    "category": "Sports Equipment",
    "description": "Stopwatch is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Stopwatch"
    ],
    "imageSearch": "Stopwatch isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Swimming Goggles",
    "category": "Sports Equipment",
    "description": "Swimming Goggles is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Swimming Goggles"
    ],
    "imageSearch": "Swimming Goggles isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Swim Cap",
    "category": "Sports Equipment",
    "description": "Swim Cap is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Swim Cap"
    ],
    "imageSearch": "Swim Cap isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Inline Skates",
    "category": "Sports Equipment",
    "description": "Inline skates are sports equipment worn on the feet for skating.",
    "aliases": [
      "Inline Skates",
      "Rollerblades"
    ],
    "imageSearch": "Inline Skates isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Bicycle Helmet",
    "category": "Sports Equipment",
    "description": "Bicycle Helmet is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Bicycle Helmet"
    ],
    "imageSearch": "Bicycle Helmet isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Tennis Ball",
    "category": "Sports Equipment",
    "description": "Tennis Ball is a piece of equipment used in a sport or physical activity.",
    "aliases": [
      "Tennis Ball"
    ],
    "imageSearch": "Tennis Ball isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Bicycle",
    "category": "Transportation Items",
    "description": "Bicycle is an object or component associated with everyday transportation.",
    "aliases": [
      "Bicycle",
      "Bike"
    ],
    "imageSearch": "Bicycle isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Bicycle Pump",
    "category": "Transportation Items",
    "description": "Bicycle Pump is an object or component associated with everyday transportation.",
    "aliases": [
      "Bicycle Pump"
    ],
    "imageSearch": "Bicycle Pump isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Bicycle Bell",
    "category": "Transportation Items",
    "description": "Bicycle Bell is an object or component associated with everyday transportation.",
    "aliases": [
      "Bicycle Bell"
    ],
    "imageSearch": "Bicycle Bell isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Bicycle Lock",
    "category": "Transportation Items",
    "description": "Bicycle Lock is an object or component associated with everyday transportation.",
    "aliases": [
      "Bicycle Lock"
    ],
    "imageSearch": "Bicycle Lock isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Car Steering Wheel",
    "category": "Transportation Items",
    "description": "Car Steering Wheel is an object or component associated with everyday transportation.",
    "aliases": [
      "Car Steering Wheel"
    ],
    "imageSearch": "Car Steering Wheel isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Car Tire",
    "category": "Transportation Items",
    "description": "Car Tire is an object or component associated with everyday transportation.",
    "aliases": [
      "Car Tire",
      "Tire"
    ],
    "imageSearch": "Car Tire isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Car Wheel",
    "category": "Transportation Items",
    "description": "Car Wheel is an object or component associated with everyday transportation.",
    "aliases": [
      "Car Wheel"
    ],
    "imageSearch": "Car Wheel isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Car Battery",
    "category": "Transportation Items",
    "description": "Car Battery is an object or component associated with everyday transportation.",
    "aliases": [
      "Car Battery"
    ],
    "imageSearch": "Car Battery isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Car Jack",
    "category": "Transportation Items",
    "description": "Car Jack is an object or component associated with everyday transportation.",
    "aliases": [
      "Car Jack"
    ],
    "imageSearch": "Car Jack isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Seat Belt",
    "category": "Transportation Items",
    "description": "Seat Belt is an object or component associated with everyday transportation.",
    "aliases": [
      "Seat Belt"
    ],
    "imageSearch": "Seat Belt isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Car Seat",
    "category": "Transportation Items",
    "description": "Car Seat is an object or component associated with everyday transportation.",
    "aliases": [
      "Car Seat"
    ],
    "imageSearch": "Car Seat isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Rearview Mirror",
    "category": "Transportation Items",
    "description": "Rearview Mirror is an object or component associated with everyday transportation.",
    "aliases": [
      "Rearview Mirror"
    ],
    "imageSearch": "Rearview Mirror isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Side Mirror",
    "category": "Transportation Items",
    "description": "Side Mirror is an object or component associated with everyday transportation.",
    "aliases": [
      "Side Mirror"
    ],
    "imageSearch": "Side Mirror isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Windshield Wiper",
    "category": "Transportation Items",
    "description": "Windshield Wiper is an object or component associated with everyday transportation.",
    "aliases": [
      "Windshield Wiper"
    ],
    "imageSearch": "Windshield Wiper isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "License Plate",
    "category": "Transportation Items",
    "description": "License Plate is an object or component associated with everyday transportation.",
    "aliases": [
      "License Plate"
    ],
    "imageSearch": "License Plate isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Traffic Cone",
    "category": "Transportation Items",
    "description": "Traffic Cone is an object or component associated with everyday transportation.",
    "aliases": [
      "Traffic Cone"
    ],
    "imageSearch": "Traffic Cone isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Road Sign",
    "category": "Transportation Items",
    "description": "Road Sign is an object or component associated with everyday transportation.",
    "aliases": [
      "Road Sign"
    ],
    "imageSearch": "Road Sign isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Train Ticket",
    "category": "Transportation Items",
    "description": "Train Ticket is an object or component associated with everyday transportation.",
    "aliases": [
      "Train Ticket"
    ],
    "imageSearch": "Train Ticket isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Bus Pass",
    "category": "Transportation Items",
    "description": "Bus Pass is an object or component associated with everyday transportation.",
    "aliases": [
      "Bus Pass"
    ],
    "imageSearch": "Bus Pass isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Suitcase",
    "category": "Transportation Items",
    "description": "Suitcase is an object or component associated with everyday transportation.",
    "aliases": [
      "Suitcase"
    ],
    "imageSearch": "Suitcase isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Luggage Tag",
    "category": "Transportation Items",
    "description": "Luggage Tag is an object or component associated with everyday transportation.",
    "aliases": [
      "Luggage Tag"
    ],
    "imageSearch": "Luggage Tag isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Car Key",
    "category": "Transportation Items",
    "description": "Car Key is an object or component associated with everyday transportation.",
    "aliases": [
      "Car Key"
    ],
    "imageSearch": "Car Key isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Motorcycle Helmet",
    "category": "Transportation Items",
    "description": "Motorcycle Helmet is an object or component associated with everyday transportation.",
    "aliases": [
      "Motorcycle Helmet"
    ],
    "imageSearch": "Motorcycle Helmet isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Skateboard",
    "category": "Transportation Items",
    "description": "Skateboard is an object or component associated with everyday transportation.",
    "aliases": [
      "Skateboard"
    ],
    "imageSearch": "Skateboard isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Scooter",
    "category": "Transportation Items",
    "description": "Scooter is an object or component associated with everyday transportation.",
    "aliases": [
      "Scooter"
    ],
    "imageSearch": "Scooter isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Paddle",
    "category": "Transportation Items",
    "description": "Paddle is an object or component associated with everyday transportation.",
    "aliases": [
      "Paddle"
    ],
    "imageSearch": "Paddle isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Life Jacket",
    "category": "Transportation Items",
    "description": "Life Jacket is an object or component associated with everyday transportation.",
    "aliases": [
      "Life Jacket"
    ],
    "imageSearch": "Life Jacket isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Oar",
    "category": "Transportation Items",
    "description": "Oar is an object or component associated with everyday transportation.",
    "aliases": [
      "Oar"
    ],
    "imageSearch": "Oar isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Fuel Can",
    "category": "Transportation Items",
    "description": "Fuel Can is an object or component associated with everyday transportation.",
    "aliases": [
      "Fuel Can"
    ],
    "imageSearch": "Fuel Can isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Charging Cable",
    "category": "Transportation Items",
    "description": "Charging Cable is an object or component associated with everyday transportation.",
    "aliases": [
      "Charging Cable"
    ],
    "imageSearch": "Charging Cable isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Milk Carton",
    "category": "Food & Everyday Products",
    "description": "Milk Carton is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Milk Carton",
      "Milk"
    ],
    "imageSearch": "Milk Carton isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Juice Box",
    "category": "Food & Everyday Products",
    "description": "Juice Box is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Juice Box"
    ],
    "imageSearch": "Juice Box isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Water Bottle",
    "category": "Food & Everyday Products",
    "description": "Water Bottle is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Water Bottle",
      "Bottle"
    ],
    "imageSearch": "Water Bottle isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Cereal Box",
    "category": "Food & Everyday Products",
    "description": "Cereal Box is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Cereal Box"
    ],
    "imageSearch": "Cereal Box isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Bread Loaf",
    "category": "Food & Everyday Products",
    "description": "Bread Loaf is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Bread Loaf"
    ],
    "imageSearch": "Bread Loaf isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Egg Carton",
    "category": "Food & Everyday Products",
    "description": "Egg Carton is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Egg Carton"
    ],
    "imageSearch": "Egg Carton isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Butter Dish",
    "category": "Food & Everyday Products",
    "description": "Butter Dish is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Butter Dish"
    ],
    "imageSearch": "Butter Dish isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Yogurt Cup",
    "category": "Food & Everyday Products",
    "description": "Yogurt Cup is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Yogurt Cup"
    ],
    "imageSearch": "Yogurt Cup isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Honey Jar",
    "category": "Food & Everyday Products",
    "description": "Honey Jar is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Honey Jar"
    ],
    "imageSearch": "Honey Jar isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Jam Jar",
    "category": "Food & Everyday Products",
    "description": "Jam Jar is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Jam Jar"
    ],
    "imageSearch": "Jam Jar isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Peanut Butter Jar",
    "category": "Food & Everyday Products",
    "description": "Peanut Butter Jar is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Peanut Butter Jar"
    ],
    "imageSearch": "Peanut Butter Jar isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Pasta Package",
    "category": "Food & Everyday Products",
    "description": "Pasta Package is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Pasta Package"
    ],
    "imageSearch": "Pasta Package isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Rice Bag",
    "category": "Food & Everyday Products",
    "description": "Rice Bag is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Rice Bag"
    ],
    "imageSearch": "Rice Bag isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Flour Bag",
    "category": "Food & Everyday Products",
    "description": "Flour Bag is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Flour Bag"
    ],
    "imageSearch": "Flour Bag isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Sugar Bowl",
    "category": "Food & Everyday Products",
    "description": "Sugar Bowl is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Sugar Bowl"
    ],
    "imageSearch": "Sugar Bowl isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Salt Shaker",
    "category": "Food & Everyday Products",
    "description": "Salt Shaker is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Salt Shaker"
    ],
    "imageSearch": "Salt Shaker isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Pepper Grinder",
    "category": "Food & Everyday Products",
    "description": "Pepper Grinder is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Pepper Grinder"
    ],
    "imageSearch": "Pepper Grinder isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Cooking Oil Bottle",
    "category": "Food & Everyday Products",
    "description": "Cooking Oil Bottle is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Cooking Oil Bottle"
    ],
    "imageSearch": "Cooking Oil Bottle isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Vinegar Bottle",
    "category": "Food & Everyday Products",
    "description": "Vinegar Bottle is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Vinegar Bottle"
    ],
    "imageSearch": "Vinegar Bottle isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Ketchup Bottle",
    "category": "Food & Everyday Products",
    "description": "Ketchup Bottle is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Ketchup Bottle"
    ],
    "imageSearch": "Ketchup Bottle isolated product photograph",
    "difficulty": "Hard"
  },
  {
    "name": "Mustard Bottle",
    "category": "Food & Everyday Products",
    "description": "Mustard Bottle is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Mustard Bottle"
    ],
    "imageSearch": "Mustard Bottle isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Mayonnaise Jar",
    "category": "Food & Everyday Products",
    "description": "Mayonnaise Jar is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Mayonnaise Jar"
    ],
    "imageSearch": "Mayonnaise Jar isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Tea Box",
    "category": "Food & Everyday Products",
    "description": "Tea Box is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Tea Box"
    ],
    "imageSearch": "Tea Box isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Coffee Jar",
    "category": "Food & Everyday Products",
    "description": "Coffee Jar is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Coffee Jar"
    ],
    "imageSearch": "Coffee Jar isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Chocolate Bar",
    "category": "Food & Everyday Products",
    "description": "Chocolate Bar is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Chocolate Bar"
    ],
    "imageSearch": "Chocolate Bar isolated product photograph",
    "difficulty": "Easy"
  },
  {
    "name": "Potato Chips Bag",
    "category": "Food & Everyday Products",
    "description": "Potato Chips Bag is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Potato Chips Bag"
    ],
    "imageSearch": "Potato Chips Bag isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Cookie Tin",
    "category": "Food & Everyday Products",
    "description": "Cookie Tin is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Cookie Tin"
    ],
    "imageSearch": "Cookie Tin isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Canned Beans",
    "category": "Food & Everyday Products",
    "description": "Canned Beans is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Canned Beans"
    ],
    "imageSearch": "Canned Beans isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Soup Can",
    "category": "Food & Everyday Products",
    "description": "Soup Can is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Soup Can"
    ],
    "imageSearch": "Soup Can isolated product photograph",
    "difficulty": "Medium"
  },
  {
    "name": "Toothpick Holder",
    "category": "Food & Everyday Products",
    "description": "Toothpick Holder is a common food item, drink container, or everyday packaged product.",
    "aliases": [
      "Toothpick Holder"
    ],
    "imageSearch": "Toothpick Holder isolated product photograph",
    "difficulty": "Hard"
  }
];

module.exports = items;
