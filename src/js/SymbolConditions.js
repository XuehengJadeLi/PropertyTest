const roofType = {
    conditions: [
      { value: 1000, description: "Flat Roof" },
      { value: 2100, description: "Shed Roof" },
      { value: 2200, description: "Offset Shed Roof" },
      { value: 3100, description: "Gabled Roof" },
      { value: 3200, description: "Hipped Roof" },
      { value: 3300, description: "Half-Hipped Roof" },
      { value: 3400, description: "Mansard Roof" },
      { value: 3500, description: "Pyramid Roof" },
      { value: 3600, description: "Conical Roof" },
      { value: 3700, description: "Dome Roof" },
      { value: 3800, description: "Shed Roof" },
      { value: 3900, description: "Arch Roof" },
      { value: 4000, description: "Tower Roof" },
      { value: 5000, description: "Mixed Form" },
      { value: 9999, description: "Other" },
    ],
  };
  
  const terrainHeight = {
    conditions: [
      { value: 110 },
      { value: 108 },
      { value: 106 },
      { value: 104 },
      { value: 100 },
    ],
  };
  
  export { roofType, terrainHeight };