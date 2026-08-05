const token = "rw_Fe26.2**065c767f5f047f96227b4a8f34fad9241bcb1f2ed92e1484017d94f2a6196c8c*i9BB_VLeobicUpPWSfkwAw*7RFzca6pTf3SrilZOY6qjXbKc6uSwykRr1f_KU4RxETKC_r-tr-5E8peaoKT3mSFsRZ4CIg7aLeFwGKHgRtHcA*1783724850416*ca1f1fe1297766634b3c2c8e3aa87c14e8a335e27960bfa6026b4fc2348da77b*NM8zEVGe0OnR6EHj0yknFLEOaBO8jpP_7bYlszmPun4";
const projectId = "99fc0166-c57d-4b3c-86bc-5f00c0074624";
const environmentId = "ff0b4405-657d-4e19-b74d-90bb4032b833";
const serviceId = "d1a3c0f6-7ebf-4584-996b-bdb7d963ff22";

const query = `
query domains($projectId: String!, $environmentId: String!, $serviceId: String!) {
  domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
    serviceDomains {
      id
      domain
      suffix
      targetPort
    }
    customDomains {
      id
      domain
      status {
        verified
        verificationToken
        dnsRecords {
          hostlabel
          requiredValue
          currentValue
          status
        }
      }
    }
  }
}
`;

async function main() {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query,
      variables: { projectId, environmentId, serviceId }
    })
  });

  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

main().catch(console.error);
