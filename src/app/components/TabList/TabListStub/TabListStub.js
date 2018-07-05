import React from 'react';
import { Segment, Dimmer, Loader, Image } from 'semantic-ui-react';

export default function TabListStub() {
  return (
    <div className="pt-2vh">
      <Segment>
        <Dimmer active inverted>
          Click on list item to get details
        </Dimmer>

        <Image src="/paragraph.png" />
      </Segment>
    </div>
  );
}
