const fs = require('fs');
const token = 'EAAM7xdqMm1kBQyrqy9j9NqYOh00W5ZByZAjjehempeeRpNZB61FyL1Of32rKE8inKhKm0sdzX6xEZCAwW4brmBwnTqqFiXkcVTyzuDBASmjg7PUCq9fiCgQztksVDMZBsjZCYBZCU5AEDMPmGI4pYv2WfhBhMEZBlPvvc8zPquQnEEbMpZBxVPpXUuto0BOv3TAZDZD';
const data = {
  clientName: 'Sessco',
  notificationEmail: 'samh@betteraccountingsolutions.com',
  metaAccountId: 'act_1250594776936088',
  metaAccessToken: token,
  thresholds: { minROAS: 2, maxCPA: 50, minSpendToEvaluate: 100 }
};
fs.writeFileSync('config/clients/sessco.json', JSON.stringify(data, null, 2));
console.log('Done');